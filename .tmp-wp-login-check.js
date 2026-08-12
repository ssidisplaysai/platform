const fs=require('fs');
function env(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const user=env('GLW_ADMIN_EMAIL');
  const pass=env('GLW_ADMIN_PASSWORD');
  const base='https://leddisplaywarehouse.com';
  const body=new URLSearchParams({log:user,pwd:pass,'wp-submit':'Log In',redirect_to:base+'/wp-admin/','testcookie':'1'}).toString();
  const res=await fetch(base+'/wp-login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,redirect:'manual'});
  const setCookie=res.headers.get('set-cookie')||'';
  const location=res.headers.get('location')||'';
  const ok=setCookie.includes('wordpress_logged_in') || location.includes('/wp-admin/');
  console.log(JSON.stringify({status:res.status,location,hasLoginCookie:setCookie.includes('wordpress_logged_in'),loginLikelyOk:ok},null,2));
})();