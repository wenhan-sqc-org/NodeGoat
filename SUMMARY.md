# Fix Summary

- 46307fd fix(contributions): replace eval() with parseInt() — CRITICAL — eval() on POST body allowed authenticated RCE via any JS expression
- 827c5be fix(allocations): sanitize threshold to prevent NoSQL injection — CRITICAL — raw threshold in $where allowed JS injection into MongoDB
- 381fc41 fix(csrf): enable csurf middleware and add tokens to all forms — HIGH — all state-changing forms were unprotected against cross-site request forgery
- <will-fill-sha> fix(auth): hash passwords with bcrypt on store and compare — HIGH — passwords stored and compared in plaintext; any DB read exposed all credentials immediately
