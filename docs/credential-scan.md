# Credential scan

The source, scripts, documentation, examples and CI configuration were scanned locally for credential patterns and compared against private values from both projects' local/runtime environment files. No matching private password or database credential was found in the scanned shareable text files. Fixed passwords in the recovery integration test were replaced with random values generated at test time.

Demo email identifiers, clearly synthetic test values and placeholder database URLs remain in source or examples where needed by seeds and tests; these are not the private passwords. Never treat a demo identity as a production account.

Ignored `.env` and `.local/` files were excluded because they intentionally contain runtime configuration and private local access information. Generated dependencies, build output, binary files and Git metadata were also outside the source scan. A pattern scan cannot establish that every possible secret has been detected.

The `.gitignore` excludes private files from Git when the folder is used as a repository. Copying or zipping the entire folder can still include ignored files; inspect the contents of any archive before sharing it. Do not publish the ignored access notes or environment files.
