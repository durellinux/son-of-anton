import { execa } from 'execa';

export interface LabelInfo {
  name: string;
  color: string;
  description: string;
}

export const REQUIRED_LABELS: LabelInfo[] = [
  { name: 'type:epic', color: '3E4B9E', description: 'Large feature or project' },
  { name: 'type:task', color: '5319E7', description: 'Individual task or issue' },
  { name: 'status:triage', color: 'FBCA04', description: 'Awaiting initial review' },
  {
    name: 'status:specifying',
    color: 'FEF2C0',
    description: 'In the process of specifying requirements',
  },
  { name: 'status:planning', color: 'C5DEF5', description: 'Planning the implementation' },
  { name: 'status:implementing', color: '0E8A16', description: 'Currently being implemented' },
  { name: 'son-of-anton', color: '000000', description: 'Issues managed by Son of Anton' },
];

export async function ensureLabels(repo: string): Promise<void> {
  console.log(`Ensuring labels for repository: ${repo}`);
  for (const label of REQUIRED_LABELS) {
    try {
      await execa('gh', [
        'label',
        'create',
        label.name,
        '--repo',
        repo,
        '--color',
        label.color,
        '--description',
        label.description,
        '--force',
      ]);
    } catch (error) {
      console.error(`Failed to ensure label '${label.name}' for ${repo}:`, error);
      // We don't throw here to allow other labels to be processed
    }
  }
}
