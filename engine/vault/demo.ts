import sampleB from '../samples/1.2.0/b-1bhk-t-junctions.plan.json' with { type: 'json' };
import sampleC from '../samples/1.2.0/c-l-hall-duct.plan.json' with { type: 'json' };
import sampleD from '../samples/1.2.0/d-open-plan-separator.plan.json' with { type: 'json' };
import type { Vault } from './vault.ts';

// The demo workspace (P14.2): folders in all six colours, nested two deep, a colour folder and an
// archived one, and three sample plans with different statuses. Neutral names, nothing from the
// design references. Run on an empty vault (`npm run vault:seed`).

export async function seedDemoVault(vault: Vault): Promise<void> {
  const folder = (
    name: string,
    parentId: string | null,
    color: Parameters<Vault['createFolder']>[0]['color'],
    style: 'glass' | 'colour' = 'glass',
  ) => vault.createFolder({ parentId, name, color, style });
  const residential = await folder('Residential', null, 'graphite');
  const plots = await folder('30×40 plots', residential.id, 'blue');
  const east = await folder('East facing', plots.id, 'blue');
  const villas = await folder('Villas', residential.id, 'green');
  await folder('Commercial', null, 'orange');
  await folder('Client boards', null, 'purple');
  await folder('Rule packs', null, 'red', 'colour');
  const archive = await folder('Archive 2025', null, 'graphite');

  const oneBhk = await vault.createFile({
    folderId: east.id,
    name: '1BHK east, T-junctions',
    plan: sampleB,
  });
  await vault.setStatus(oneBhk.id, 'in_review');
  await vault.setStar(oneBhk.id, true);
  const lHall = await vault.createFile({
    folderId: villas.id,
    name: 'L-hall with duct',
    plan: sampleC,
  });
  await vault.setStatus(lHall.id, 'approved');
  await vault.createFile({ folderId: plots.id, name: 'Open plan, living + dining', plan: sampleD });
  await vault.archive(archive.id);
}
