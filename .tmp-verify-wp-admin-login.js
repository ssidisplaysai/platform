const fs=require('fs');
const envLines=fs.readFileSync('.env','utf8').split(/\r?\n/).filter(line=>/^[A-Za-z_][A-Za-z0-9_]*=/.test(line));
for(const line of envLines){const parts=line.split('=',2); let value=parts[1]??''; if(value.startsWith('"')&&value.endsWith('"')) value=value.slice(1,-1); process.env[parts[0]]=value;}
const email=process.env.GLW_ADMIN_EMAIL;
const password=process.env.GLW_ADMIN_PASSWORD;
if (!email || !password) throw new Error('Missing admin env vars');
function cookieHeader(setCookies){return setCookies.map(c=>c.split(';')[0]).join('; ');}
(async()=>{
  const loginPage=await fetch('https://leddisplaywarehouse.com/wp-login.php',{redirect:'manual'});
  const cookies1=loginPage.headers.get('set-cookie') ? [loginPage.headers.get('set-cookie')] : [];
  const loginForm=new URLSearchParams({
    log: email,
    pwd: password,
    rememberme: 'forever',
    'wp-submit': 'Log In',
    redirect_to: 'https://leddisplaywarehouse.com/wp-admin/',
    testcookie: '1'
  });
  const post=await fetch('https://leddisplaywarehouse.com/wp-login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Cookie':cookieHeader(cookies1)},body:loginForm.toString(),redirect:'manual'});
  const cookies2=post.headers.get('set-cookie') ? [post.headers.get('set-cookie')] : [];
  const cookieJar=[...cookies1,...cookies2].filter(Boolean);
  const admin=await fetch('https://leddisplaywarehouse.com/wp-admin/',{headers:{Cookie:cookieHeader(cookieJar)},redirect:'follow'});
  const adminText=await admin.text();
  console.log(JSON.stringify({
    loginPageStatus: loginPage.status,
    postStatus: post.status,
    postLocation: post.headers.get('location'),
    adminStatus: admin.status,
    adminHasDashboard: /Dashboard|Welcome|wp-admin/i.test(adminText),
    adminHasLoginForm: /wp-login\.php|user_login|Password/i.test(adminText),
  },null,2));
})();