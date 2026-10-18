import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('cloud',Path(__file__).with_name('deploy-cloud.py'))
cloud=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)


class CloudReleaseTests(unittest.TestCase):
    def config(self):
        return {'deployment':{'adapter':'ecs-image','cluster':'app','service':'app','container':'api',
                 'required_secret_names':['PRIVATE_KEY'],'health_url':'https://example.invalid/ready',
                 'health_commit_path':['commit'],'attestation_environment':{'BUILD_SHA':'{commit}'}}}

    def definition(self):
        return {'family':'app','taskDefinitionArn':'old','revision':1,
                'containerDefinitions':[{'name':'api','image':'old@sha256:x',
                    'environment':[{'name':'PRESERVE','value':'yes'}],
                    'secrets':[{'name':'PRIVATE_KEY','valueFrom':'arn:aws:secretsmanager:unchanged'}]}]}

    def test_ecs_preserves_secrets_and_rolls_back_after_exact_health_failure(self):
        definition=self.definition();state={'task':'old'};registered=[];updates=[]
        def aws(config,service,operation,*args,payload=None):
            if operation=='describe-services':
                return {'services':[{'taskDefinition':state['task'],'runningCount':1,'desiredCount':1,
                                     'pendingCount':0,'deployments':[{'taskDefinition':state['task']}]}]}
            if operation=='describe-task-definition':return {'taskDefinition':definition}
            if operation=='register-task-definition':
                registered.append(payload)
                return {'taskDefinition':{'taskDefinitionArn':'new'}}
            if operation=='update-service':
                state['task']=payload['taskDefinition'];updates.append(state['task']);return {}
            raise AssertionError(operation)
        receipt={'commit':'a'*40,'package':{'image':'new@sha256:y','image_digest':'sha256:y'}}
        with patch.object(cloud,'exact_health',side_effect=RuntimeError('wrong source')), \
             patch.object(cloud,'basic_health'):
            with self.assertRaisesRegex(RuntimeError,'wrong source'):
                cloud.ecs(self.config(),receipt,False,aws)
        self.assertEqual(updates,['new','old'])
        self.assertEqual(registered[0]['containerDefinitions'][0]['secrets'],
                         [{'name':'PRIVATE_KEY','valueFrom':'arn:aws:secretsmanager:unchanged'}])
        self.assertIn({'name':'PRESERVE','value':'yes'},registered[0]['containerDefinitions'][0]['environment'])
        self.assertNotIn('taskDefinitionArn',registered[0])

    def test_ecs_stale_rollback_never_updates_service(self):
        def aws(*args,**kwargs):
            self.assertEqual(args[2],'describe-services')
            return {'services':[{'taskDefinition':'newer'}]}
        with self.assertRaisesRegex(RuntimeError,'Stale'):
            cloud.ecs(self.config(),{'deployed_task':'old','previous_task':'older'},True,aws)

    def test_missing_secret_binding_fails_before_new_revision(self):
        definition=self.definition();definition['containerDefinitions'][0]['secrets']=[]
        def aws(*args,**kwargs):
            if args[2]=='describe-services':return {'services':[{'taskDefinition':'old'}]}
            if args[2]=='describe-task-definition':return {'taskDefinition':definition}
            raise AssertionError('Unexpected mutation')
        with self.assertRaisesRegex(RuntimeError,'secret bindings'):
            cloud.ecs(self.config(),{'commit':'a'*40,'package':{'image':'x'}},False,aws)

    def test_static_stale_rollback_never_switches_origin(self):
        config={'deployment':{'distribution':'D','origin_id':'site'}}
        def aws(*args,**kwargs):
            self.assertEqual(args[2],'get-distribution-config')
            return {'ETag':'x','DistributionConfig':{'Origins':{'Items':[{'Id':'site','OriginPath':'/releases/newer'}]}}}
        with self.assertRaisesRegex(RuntimeError,'Stale'):
            cloud.static_site(config,{'deployed_origin_path':'/releases/old'},True,aws,None)


if __name__=='__main__':unittest.main()
