export async function cleanDeletedAccountFiles(admin: any) {
  const { data, error } = await admin.rpc('claim_account_deletion_files');
  if (error) throw new Error('cleanup_claim_failed');
  for (const file of data ?? []) {
    const { error: removeError } = await admin.storage.from(file.bucket_id).remove([file.object_name]);
    if (!removeError) {
      const { error: ackError } = await admin.from('account_deletion_files').delete().eq('id', file.id);
      if (ackError) console.error('account deletion cleanup acknowledgement failed');
    } else console.error('account deletion storage cleanup deferred');
  }
}
