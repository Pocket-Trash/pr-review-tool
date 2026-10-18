# Security policy

## Trust boundary

Pull-request titles, descriptions, patches, files, diagrams, and external skill text are untrusted. The reusable reviewer must retrieve them as data through GitHub APIs and must not check out, install, build, test, or execute pull-request-controlled code. Unprivileged development CI may test changes to this tool without receiving provider or publication credentials.

Provider credentials and GitHub App credentials are separate. The model process must never receive a GitHub write token or App private key. Configuration, prompts, dependency pins, and generated-file exclusions come only from the trusted base branch.

## Reporting a vulnerability

Report vulnerabilities through GitHub private vulnerability reporting for this repository. Do not open a public issue containing exploit details or credentials.
