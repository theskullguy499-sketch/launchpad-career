import { confirmedUser } from './auth-client.js';
// Ownership is enforced by PostgreSQL RLS, not by UI filters or supplied IDs.
export function createCloudData(client) {
  async function checked(query) { const { data,error } = await query;if(error) throw error;return data; }
  return {
    async profile() { const user = await confirmedUser(client);return checked(client.from('user_profiles').select('*').eq('id',user.id).single()); },
    async updateProfile(displayName) { const user = await confirmedUser(client);return checked(client.from('user_profiles').update({display_name:displayName}).eq('id',user.id)); },
    async saveGuestBackup(backup) {
      await confirmedUser(client);
      // One transaction; import is additive and never deletes/overwrites existing cloud rows.
      return checked(client.rpc('import_guest_backup',{backup}));
    },
    async downloadBackup() {
      const user = await confirmedUser(client);
      const [applications, progress, tasks] = await Promise.all([
        checked(client.from('job_applications').select('*').eq('user_id',user.id).order('created_at')),
        checked(client.from('roadmap_progress').select('*').eq('user_id',user.id)),
        checked(client.from('tasks').select('*').eq('user_id',user.id))
      ]);
      return {app:'launchpad',formatVersion:1,savedAt:new Date().toISOString(),
        applications:applications.map(a=>({id:a.local_id||a.id,company:a.company,role:a.role,country:a.country,status:a.status,deadline:a.deadline||'',url:a.url,notes:a.notes,createdAt:a.created_at})),
        completed:progress.filter(p=>p.completed && /^[0-5]$/.test(p.milestone_key)).map(p=>Number(p.milestone_key)),tasks};
    }
  };
}
