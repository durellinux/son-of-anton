import { execa } from 'execa';
import * as restateClients from '@restatedev/restate-sdk-clients';
import { issueWorkflowV1 } from '../workflows/issueWorkflowV1';
import crypto from 'node:crypto';

export interface WorkflowMapping {
  requiredLabels: string[];
  workflow: any;
  workflowName: string;
}

export class GitHubPoller {
  private restateClient: any;
  private mappings: WorkflowMapping[];
  private log: any;

  constructor(restateClient: any, log: any) {
    this.restateClient = restateClient;
    this.log = log;
    this.mappings = [
      {
        requiredLabels: ['son-of-anton', 'status:triage'],
        workflow: issueWorkflowV1,
        workflowName: 'IssueWorkflowV1',
      },
    ];
  }

  private calculateLabelsHash(labels: string[]): string {
    // We sort labels to ensure the hash is consistent regardless of order
    return crypto
      .createHash('sha1')
      .update(labels.sort().join(','))
      .digest('hex')
      .substring(0, 8);
  }

  public async poll() {
    this.log.info('Polling GitHub issues...');
    try {
      const args = [
        'search',
        'issues',
        '--label',
        'son-of-anton',
        '--state',
        'open',
        '--json',
        'number,title,url,labels,repository',
      ];

      const githubRepos = process.env.GITHUB_REPOS;
      if (githubRepos) {
        const repos = githubRepos.split(',').map((r) => r.trim());
        for (const repo of repos) {
          args.push('--repo', repo);
        }
      } else {
        args.push('--owner', '@me');
      }

      const { stdout } = await execa('gh', args);

      const issues = JSON.parse(stdout) as any[];
      this.log.info(`Found ${issues.length} issues with label 'son-of-anton'.`);

      for (const issue of issues) {
        const issueLabels = issue.labels.map((l: any) => l.name);
        
        for (const mapping of this.mappings) {
          const matches = mapping.requiredLabels.every(label => issueLabels.includes(label));
          
          if (matches) {
            const labelsHash = this.calculateLabelsHash(issueLabels);
            // The ID includes the labelsHash to ensure each unique state change triggers a new workflow instance.
            // Restate maintains idempotency for the same ID. By including the labelsHash, we ensure that
            // if the issue's labels change, we trigger a new processing loop (or the same one re-evaluates).
            // Restate idempotency retention is typically 1 month by default.
            const workflowId = `issue-${issue.number}-${mapping.workflowName}-${labelsHash}`;
            
            this.log.info(`Issue #${issue.number} matches ${mapping.workflowName} requirements. Triggering with ID ${workflowId}...`);
            
            const workflowClient = await this.restateClient.workflowClient(
              mapping.workflow,
              workflowId
            );
            
            try {
              await workflowClient.workflowSubmit({
                number: issue.number,
                title: issue.title,
                url: issue.url,
                repository: issue.repository.nameWithOwner,
              });
              this.log.info(`Successfully submitted workflow for issue #${issue.number} with ID ${workflowId}`);
            } catch (submitError: any) {
              // If it's already running or completed with this ID, Restate handles it.
              // We log it just in case.
              this.log.warn(`Could not submit workflow for issue #${issue.number}: ${submitError.message}`);
            }
          }
        }
      }
    } catch (error) {
      this.log.error('Error during GitHub polling:', error);
    }
  }
}
