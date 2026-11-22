#!/usr/bin/env bash
# Create a license and onboard the tenant via the APIs. Safe on a fresh tenant DB.
set -uo pipefail

INTEL="${INTEL:-http://localhost:9090}"
TENANT="${TENANT:-http://localhost:9091}"

if [ -f "$HOME/.bash_profile" ]; then set -a; . "$HOME/.bash_profile" >/dev/null 2>&1; set +a; fi

ORG_NAME="${ORG_NAME:-Mam Corp}"
ORG_ADDRESS="${ORG_ADDRESS:-No 121, Lewis Street, Lagos Island, Lagos}"
ORG_EMAIL="${ORG_EMAIL:-compliance@atheris.test}"
ADMIN_FULL_NAME="${ADMIN_FULL_NAME:-Break Glass Admin}"
TENANT_USERNAME="${TENANT_USERNAME:-super@atheris.test}"
TENANT_PASSWORD="${TENANT_PASSWORD:-Passw0rd!}"
TIER="${TIER:-standard}"

AUTH_TYPE="${AUTH_TYPE:-ldap}"
LDAP_URL="${LDAP_URL:-ldap://localhost:1389}"
LDAP_BIND_DN="${LDAP_BIND_DN:-cn=admin,dc=atheris,dc=test}"
LDAP_BIND_PASSWORD="${LDAP_BIND_PASSWORD:-adminpassword}"
LDAP_SEARCH_BASE="${LDAP_SEARCH_BASE:-ou=people,dc=atheris,dc=test}"
LDAP_LOGIN_ATTR="${LDAP_LOGIN_ATTR:-mail}"
LDAP_NAME_ATTR="${LDAP_NAME_ATTR:-cn}"
CCO_USERNAME="${CCO_USERNAME:-cco@atheris.test}"
CCO_NAME="${CCO_NAME:-Chidi Compliance}"
ANALYST_USERNAME="${ANALYST_USERNAME:-analyst@atheris.test}"
ANALYST_NAME="${ANALYST_NAME:-Adaeze Analyst}"

jq_get() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

echo "== intel admin login =="
TOKEN=$(curl -s -X POST "$INTEL/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" | jq_get "['accessToken']")
[ -z "$TOKEN" ] && { echo "login failed (check ADMIN_USERNAME/ADMIN_PASSWORD)"; exit 1; }

EXPIRE=$(python3 -c "import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(days=365)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
echo "== create license (autoSeedObligations) =="
LIC=$(curl -s -X POST "$INTEL/api/v1/admin/licenses" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"tier\":\"$TIER\",\"intelligenceEnabled\":true,\"maxUsers\":200,\"maxDevices\":50,\"maxStorageMb\":20480,\"gracePeriodDays\":30,\"deviceFingerprintEnforced\":false,\"autoSeedObligations\":true,\"expiresAt\":\"$EXPIRE\"}")
KEY=$(echo "$LIC" | jq_get "['licenseKey']")
[ -z "$KEY" ] && { echo "license create failed: $LIC"; exit 1; }
echo "licenseKey=$KEY"

echo "== activate-license =="
curl -s -X POST "$TENANT/api/v1/onboarding/activate-license" -H 'Content-Type: application/json' \
  -d "{\"licenseKey\":\"$KEY\"}" >/dev/null

echo "== read available regulators =="
IDS=""
for i in $(seq 1 30); do
  STATUS=$(curl -s -m 10 "$TENANT/api/v1/onboarding/status")
  IDS=$(echo "$STATUS" | python3 -c "import sys,json;d=json.load(sys.stdin);print(','.join(str(r['regulatorId']) for r in (d.get('availableRegulators') or []) if r.get('regulatorId')))" 2>/dev/null)
  [ -n "$IDS" ] && break
  sleep 2
done
[ -z "$IDS" ] && { echo "no regulators available — is the intel platform API up?"; exit 1; }
echo "regulators=$IDS"
IDS_JSON="[$IDS]"

echo "== institution =="
curl -s -X POST "$TENANT/api/v1/onboarding/institution" -H 'Content-Type: application/json' \
  -d "{\"legalName\":\"$ORG_NAME\",\"address\":\"$ORG_ADDRESS\",\"contactEmail\":\"$ORG_EMAIL\"}" >/dev/null

echo "== user-setup ($AUTH_TYPE) =="
if [ "$AUTH_TYPE" = "ldap" ]; then
  USER_SETUP=$(cat <<JSON
{"authType":"ldap",
 "ldapConfig":{"url":"$LDAP_URL","bindDn":"$LDAP_BIND_DN","bindPassword":"$LDAP_BIND_PASSWORD","userSearchBase":"$LDAP_SEARCH_BASE","userSearchFilterAttribute":"$LDAP_LOGIN_ATTR","fullNameAttribute":"$LDAP_NAME_ATTR"},
 "breakGlassAdmin":{"fullName":"$ADMIN_FULL_NAME","email":"$TENANT_USERNAME","password":"$TENANT_PASSWORD"},
 "seedUsers":[
   {"role":"CCO","fullName":"$CCO_NAME","email":"$CCO_USERNAME"},
   {"role":"ANALYST","fullName":"$ANALYST_NAME","email":"$ANALYST_USERNAME"}
 ]}
JSON
)
else
  USER_SETUP="{\"authType\":\"local\",\"localAdmin\":{\"fullName\":\"$ADMIN_FULL_NAME\",\"email\":\"$TENANT_USERNAME\",\"password\":\"$TENANT_PASSWORD\"}}"
fi
curl -s -X POST "$TENANT/api/v1/onboarding/user-setup" -H 'Content-Type: application/json' -d "$USER_SETUP" >/dev/null

echo "== regulators (intelligence) =="
curl -s -X POST "$TENANT/api/v1/onboarding/regulators" -H 'Content-Type: application/json' \
  -d "{\"subscribedRegulators\":$IDS_JSON}" >/dev/null

echo "== toolkit-regulators =="
curl -s -X POST "$TENANT/api/v1/onboarding/toolkit-regulators" -H 'Content-Type: application/json' \
  -d "{\"subscribedRegulators\":$IDS_JSON}" >/dev/null

echo "== confirm =="
curl -s -X POST "$TENANT/api/v1/onboarding/confirm" -H 'Content-Type: application/json' -d '{}'

echo
echo "== poll seed-status =="
for i in $(seq 1 48); do
  S=$(curl -s -m 10 "$TENANT/api/v1/onboarding/seed-status")
  echo " $S"
  echo "$S" | grep -q '"seeded":true' && break
  sleep 5
done

echo "== stakeholders: write people file (once) =="
PEOPLE_CSV="${PEOPLE_CSV:-$HOME/.atheris/stakeholders.csv}"
mkdir -p "$(dirname "$PEOPLE_CSV")"
if [ -f "$PEOPLE_CSV" ]; then
  echo "using existing $PEOPLE_CSV"
else
  cat > "$PEOPLE_CSV" <<'CSV'
name,email,title,department,unit
Chidi Compliance,cco@atheris.test,Chief Compliance Officer,Compliance,AML/CFT
Adaeze Analyst,analyst@atheris.test,Compliance Officer,Compliance,AML/CFT
Bashir Adewale,headofcompliance@atheris.test,Head of Compliance,Compliance,Regulatory Compliance
Kelechi Nwosu,regulatorycompliance@atheris.test,Compliance Officer,Compliance,Regulatory Compliance
Aisha Mohammed,dataprotection@atheris.test,Data Protection Officer,Compliance,Data Protection
Halima Sani,aml@atheris.test,Head of AML/CFT,Compliance,AML/CFT
Uche Balogun,monitoringtesting@atheris.test,Compliance Monitoring Officer,Compliance,Monitoring & Testing
Zainab Okoro,conductethics@atheris.test,Ethics Officer,Compliance,Conduct & Ethics
Emeka Obi,headofrisk@atheris.test,Chief Risk Officer,Risk Management,Enterprise Risk
Ngozi Eze,enterpriserisk@atheris.test,Risk Manager,Risk Management,Enterprise Risk
Tunde Bello,operationalrisk@atheris.test,Operational Risk Manager,Risk Management,Operational Risk
Fatima Yusuf,creditrisk@atheris.test,Credit Risk Manager,Risk Management,Credit Risk
Dapo Adeyemi,marketliquidityrisk@atheris.test,Market Risk Manager,Risk Management,Market & Liquidity Risk
Ifeoma Chukwu,headofit@atheris.test,Head of IT,Information Technology,Core Banking
Segun Lawal,corebanking@atheris.test,Core Banking Manager,Information Technology,Core Banking
Amara Nnamdi,dba@atheris.test,Database Administrator,Information Technology,Database Administration
Yusuf Danjuma,network@atheris.test,Network Manager,Information Technology,Networking
Blessing Ogu,sysadmin@atheris.test,System Administrator,Information Technology,System Administration
Ahmed Suleiman,itsecurity@atheris.test,Chief Information Security Officer,Information Technology,IT Security
Chioma Okafor,headofoperations@atheris.test,Head of Operations,Operations,Branch Operations
Gbenga Ojo,branchoperations@atheris.test,Branch Manager,Operations,Branch Operations
Rukayat Bello,cashmanagement@atheris.test,Cash Management Head,Operations,Cash Management
Peter Eze,transactionprocessing@atheris.test,Operations Controller,Operations,Transaction Processing
Amina Garba,tradeservices@atheris.test,Trade Services Manager,Operations,Trade Services
Chinedu Obi,customerservice@atheris.test,Customer Service Manager,Operations,Customer Service
Bode Ajayi,headoffinance@atheris.test,Chief Financial Officer,Finance & Treasury,Financial Control
Nneka Umeh,financialcontrol@atheris.test,Financial Controller,Finance & Treasury,Financial Control
Sadiq Abubakar,treasury@atheris.test,Treasury Manager,Finance & Treasury,Treasury
Ify Okonkwo,regulatoryreporting@atheris.test,Head of Regulatory Reporting,Finance & Treasury,Regulatory Reporting
Musa Ibrahim,tax@atheris.test,Tax Manager,Finance & Treasury,Tax
Grace Adeniyi,procurement@atheris.test,Procurement Manager,Finance & Treasury,Procurement
Amaka Uche,chiefauditexecutive@atheris.test,Chief Audit Executive,Internal Audit,Audit Operations
Femi Adeleke,auditoperations@atheris.test,Internal Audit Manager,Internal Audit,Audit Operations
Hauwa Musa,auditassurance@atheris.test,Quality Assurance Officer,Internal Audit,Audit Assurance
Oyinkan Adebayo,headoflegal@atheris.test,Head of Legal,Legal & Company Secretariat,Legal Advisory
Chuka Nwankwo,legaladvisory@atheris.test,Legal Counsel,Legal & Company Secretariat,Legal Advisory
Bolanle Salami,companysecretariat@atheris.test,Company Secretary,Legal & Company Secretariat,Company Secretariat
Idris Yakubu,litigationdisputes@atheris.test,Legal Manager,Legal & Company Secretariat,Litigation & Disputes
Temitope Fashola,headofhr@atheris.test,HR Director,Human Resources,HR Operations
Ndidi Anyanwu,hroperations@atheris.test,HR Manager,Human Resources,HR Operations
Kola Ogunleye,learningdevelopment@atheris.test,HR Business Partner,Human Resources,Learning & Development
Chisom Ike,recruitment@atheris.test,Talent Acquisition,Human Resources,Recruitment
CSV
  echo "wrote $PEOPLE_CSV"
fi

echo "== login (tenant) for stakeholder import =="
TTOKEN=$(curl -s -m 10 -X POST "$TENANT/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$TENANT_USERNAME\",\"password\":\"$TENANT_PASSWORD\"}" | jq_get "['accessToken']")
[ -z "$TTOKEN" ] && { echo "tenant login failed — cannot import stakeholders"; exit 1; }
echo "== bulk import stakeholders =="
curl -s -m 30 -X POST "$TENANT/api/v1/stakeholders/bulk-import" \
  -H "Authorization: Bearer $TTOKEN" -F "file=@$PEOPLE_CSV;type=text/csv"; echo
echo "done"
