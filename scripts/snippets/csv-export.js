function(users) {
  const fields = ['id', 'username', 'full_name', 'is_verified', 'is_private', 'profile_pic_url'];
  function cell(value) {
    let text = String(value == null ? '' : value);
    if (/^[\t\r\n ]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  const content = [fields.map(cell).join(',')].concat(users.map(user => fields.map(field => cell(user[field])).join(','))).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'instagram_unfollowers.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
