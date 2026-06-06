import { execa } from 'execa';
import { issueWorkflowV1 } from '../workflows/issueWorkflowV1';
import { epicSpecificationWorkflow } from '../workflows/epicSpecificationWorkflow';

export interface WorkflowMapping {
  requiredLabels: string[];
  workflow: any;
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
        requiredLabels: ['type:epic', 'status:triage'],
        workflow: epicSpecificationWorkflow,
      },
      {
        requiredLabels: ['son-of-anton'],
        workflow: issueWorkflowV1,
      },
    ];
  }

  public async poll() {
    this.log.info('Polling GitHub issues...');
    try {
      const args = [
        'search',
        'issues',
        'label:son-of-anton OR (label:type:epic label:status:triage)',
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
          const matches = mapping.requiredLabels.every((label) => issueLabels.includes(label));

          if (matches) {
            const workflowId = `issue-${issue.number}`;

            this.log.info(
              `Issue #${issue.number} matches requirements. Triggering with ID ${workflowId}...`,
            );

            try {
              await this.restateClient.send({
                service: mapping.workflow.name,
                handler: 'run',
                parameter: {
                  number: issue.number,
                  title: issue.title,
                  url: issue.url,
                  repository: issue.repository.nameWithOwner,
                },
                key: workflowId,
              });
              this.log.info(
                `Successfully submitted workflow for issue #${issue.number} with ID ${workflowId}`,
              );
            } catch (submitError: any) {
              // If it's already running or completed with this ID, Restate handles it.
              // We log it just in case.
              this.log.warn(
                `Could not submit workflow for issue #${issue.number}: ${submitError.message}`,
              );
            }
          }
        }
      }
    } catch (error: any) {
      this.log.error({ err: error }, `Error during GitHub polling: ${error.message || error}`);
      if (error.stack) {
        this.log.error(error.stack);
      }
    }
  }
}
