# Fix Summary

- 46307fd fix(contributions): replace eval() with parseInt() — CRITICAL — eval() on POST body allowed authenticated RCE via any JS expression
- 827c5be fix(allocations): sanitize threshold to prevent NoSQL injection — CRITICAL — raw threshold in $where allowed JS injection into MongoDB
- 381fc41 fix(csrf): enable csurf middleware and add tokens to all forms — HIGH — all state-changing forms were unprotected against cross-site request forgery
- 01633e4 fix(auth): hash passwords with bcrypt on store and compare — HIGH — passwords stored and compared in plaintext; any DB read exposed all credentials immediately
- ef64809 fix(redirect): allowlist /learn redirect destination — HIGH — open redirect allowed phishing via trusted domain
- c7f1957 fix(xss): enable swig autoescape and add | safe to intentional HTML — HIGH — autoescape: false exposed every template variable as a raw XSS vector
- <will-fill-sha> fix(session): set httpOnly: true on session cookie — HIGH — cookie was JS-readable, enabling session theft via any XSS
