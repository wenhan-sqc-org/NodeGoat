# Fix Summary

- 46307fd fix(contributions): replace eval() with parseInt() — CRITICAL — eval() on POST body allowed authenticated RCE via any JS expression
- 827c5be fix(allocations): sanitize threshold to prevent NoSQL injection — CRITICAL — raw threshold in $where allowed JS injection into MongoDB
- 381fc41 fix(csrf): enable csurf middleware and add tokens to all forms — HIGH — all state-changing forms were unprotected against cross-site request forgery
- 01633e4 fix(auth): hash passwords with bcrypt on store and compare — HIGH — passwords stored and compared in plaintext; any DB read exposed all credentials immediately
- ef64809 fix(redirect): allowlist /learn redirect destination — HIGH — open redirect allowed phishing via trusted domain
- c7f1957 fix(xss): enable swig autoescape and add | safe to intentional HTML — HIGH — autoescape: false exposed every template variable as a raw XSS vector
- 70acb33 fix(session): set httpOnly: true on session cookie — HIGH — cookie was JS-readable, enabling session theft via any XSS
- b204bcf fix(ssrf): allowlist url and symbol on research endpoint — HIGH — both params were fully attacker-controlled, enabling SSRF and internal service probing
- bfbed1b fix(authz): add isAdmin gate to both /benefits routes — HIGH — any authenticated user could view and modify all users' benefit dates
- 20c9cae fix(session): regenerate session ID on login to prevent fixation — HIGH — pre-login session ID persisted after auth, enabling session fixation attacks
- 2543763 fix(crypto): encrypt SSN/DOB at rest in profile-dao — MEDIUM — SSN and DOB stored as plaintext; any DB read or secondary vuln exposed raw PII
- <will-fill-sha> fix(redos): remove nested quantifier in bankRouting regex — MEDIUM — /([0-9]+)+\#/ caused exponential backtracking; authenticated user could stall the event loop
