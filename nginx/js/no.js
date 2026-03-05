function randomReason() {
  var fs = require('fs');
  var data = fs.readFileSync('/etc/nginx/no/reasons.json');
  var reasons = JSON.parse(data);
  var list = reasons && reasons.reasons ? reasons.reasons : [];
  if (!list.length) {
    return "No.";
  }
  var idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function noHandler(r) {
  var reason = randomReason();
  r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
  r.headersOut['Cache-Control'] = 'no-store';
  r.return(200, JSON.stringify({ reason: reason }));
}

export default { noHandler };
