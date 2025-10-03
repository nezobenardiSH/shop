# 🚀 Deployment Guide for Merchant Portal with PIN Authentication

## Prerequisites
- GitHub repository with your code
- Render account (free tier or paid)
- Salesforce credentials

## 1. Prepare for Production

### Update package.json scripts
Ensure your package.json has the correct build and start scripts:
```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### Create Production Environment File
Create `.env.production.local` (for local testing of production build):
```env
NODE_ENV=production
JWT_SECRET=your-production-secret-here
SF_USERNAME=your.salesforce@email.com
SF_PASSWORD=yourpassword
SF_TOKEN=yoursecuritytoken
SF_LOGIN_URL=https://test.salesforce.com
```

## 2. Generate Secure JWT Secret

Run this command locally to generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Save this value - you'll need it for Render environment variables.

## 3. Push to GitHub

```bash
git add .
git commit -m "Add PIN authentication system"
git push origin main
```

## 4. Deploy to Render

### Option A: Using Render Dashboard (Recommended)

1. **Create New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Choose the branch (usually `main`)

2. **Configure Build Settings**
   - **Name**: merchant-portal
   - **Region**: Singapore (or closest to your users)
   - **Branch**: main
   - **Root Directory**: merchant-portal (if in subdirectory)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Set Environment Variables** (CRITICAL)
   ```
   JWT_SECRET=<your-generated-secret>
   NODE_ENV=production
   SF_USERNAME=<your-salesforce-username>
   SF_PASSWORD=<your-salesforce-password>
   SF_TOKEN=<your-salesforce-token>
   SF_LOGIN_URL=https://test.salesforce.com
   ```

4. **Advanced Settings**
   - **Health Check Path**: /api/health
   - **Plan**: Starter ($7/month) or Free (for testing)

### Option B: Using render.yaml (Infrastructure as Code)

The render.yaml is already configured. Just:
1. Push to GitHub
2. In Render Dashboard, click "New +" → "Blueprint"
3. Connect your repo
4. Render will auto-detect render.yaml

## 5. Post-Deployment Configuration

### Set NEXTAUTH_URL
After deployment, get your Render URL and set it:
1. Go to Environment tab in Render
2. Add: `NEXTAUTH_URL=https://merchant-portal.onrender.com`

### Configure Custom Domain (Optional)
1. Go to Settings → Custom Domains
2. Add your domain
3. Update DNS records as instructed

## 6. Security Checklist

### Environment Variables
- [x] JWT_SECRET is unique and secure (NOT the default)
- [x] Salesforce credentials are set via dashboard (not in code)
- [x] NODE_ENV is set to "production"

### Application Security
- [x] Cookies are httpOnly (already configured)
- [x] Cookies are secure in production (already configured)
- [x] Rate limiting is active (5 attempts, 15-min lockout)
- [x] HTTPS is enforced by Render

### Additional Recommendations
1. **Enable 2FA on Render account**
2. **Restrict IP access** (if applicable)
3. **Set up monitoring alerts**
4. **Regular security audits**

## 7. Testing Production Deployment

### Health Check
```bash
curl https://your-app.onrender.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Test Authentication Flow
1. Visit: `https://your-app.onrender.com/merchant/Nasi-Lemak`
2. Should redirect to login
3. Enter PIN (last 4 digits of registered phone)
4. Should access portal successfully

### Test SSL/Security Headers
```bash
curl -I https://your-app.onrender.com
# Check for security headers
```

## 8. Monitoring & Maintenance

### Render Dashboard Monitoring
- **Metrics**: CPU, Memory, Response times
- **Logs**: Real-time application logs
- **Alerts**: Set up email/Slack alerts

### Log Debugging
```bash
# View logs in Render Dashboard or use Render CLI
render logs --tail
```

### Common Issues & Solutions

**Issue: "Invalid token" errors**
- Solution: Ensure JWT_SECRET is the same across deployments

**Issue: "Session expired" immediately**
- Solution: Check server time sync and JWT expiry settings

**Issue: Can't connect to Salesforce**
- Solution: Verify SF_TOKEN is appended to password
- Check if Salesforce IP restrictions need Render's IPs

**Issue: Slow cold starts**
- Solution: Upgrade to paid plan for always-on instances

## 9. Scaling Considerations

### When to Upgrade
- **Starter Plan ($7/month)**: 512MB RAM, always on
- **Standard Plan**: More RAM, auto-scaling
- **Pro Plan**: Multiple instances, load balancing

### Database (if needed later)
```yaml
databases:
  - name: portal-db
    plan: starter  # $7/month
    databaseName: merchants
```

## 10. Backup & Recovery

### Application Code
- Already in GitHub
- Use tags for production releases

### Environment Variables
- Document all env vars
- Store securely (not in code)
- Use Render's backup features

### Salesforce Data
- Already backed up in Salesforce
- Consider local caching strategy if needed

## Important URLs

### Production
- App: `https://merchant-portal.onrender.com`
- Health: `https://merchant-portal.onrender.com/api/health`
- Login: `https://merchant-portal.onrender.com/login/[merchant-name]`

### Monitoring
- Render Dashboard: `https://dashboard.render.com`
- GitHub Repo: `https://github.com/[your-username]/[repo-name]`

## Emergency Procedures

### Rollback Deployment
1. Go to Render Dashboard → Events
2. Find previous successful deploy
3. Click "Rollback to this deploy"

### Disable Authentication (Emergency)
Set environment variable:
```
DISABLE_AUTH=true  # Add this feature if needed
```

### Contact Support
- Render Support: https://render.com/support
- Salesforce Support: Your SF admin

---

## Pre-Deployment Checklist

- [ ] Generate secure JWT_SECRET
- [ ] Test locally with production build
- [ ] Verify all environment variables
- [ ] Push latest code to GitHub
- [ ] Review security settings
- [ ] Plan maintenance window (if needed)
- [ ] Notify users of deployment

## Post-Deployment Checklist

- [ ] Verify health endpoint
- [ ] Test login with all PIN types
- [ ] Check Salesforce connection
- [ ] Monitor error logs
- [ ] Test logout functionality
- [ ] Verify SSL certificate
- [ ] Update documentation
- [ ] Inform team of successful deployment

---

**Last Updated**: October 2024
**Maintained By**: DevOps Team