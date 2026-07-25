CREATE TABLE IF NOT EXISTS risk_types (
    risk_type_id   SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    description    TEXT,
    display_order  INT DEFAULT 0
);

INSERT INTO risk_types (name, description, display_order) VALUES
    ('Regulatory Fine / Penalty', 'Monetary penalty imposed by a regulatory body for non-compliance', 1),
    ('Reputational Damage', 'Loss of public trust, negative media coverage, brand erosion', 2),
    ('Operational Disruption', 'Interruption to business operations, processes, or systems', 3),
    ('Legal / Litigation', 'Lawsuits, legal proceedings, or regulatory enforcement actions', 4),
    ('Financial Loss', 'Direct financial loss beyond fines, including remediation costs', 5),
    ('Data Breach / Privacy', 'Unauthorised access, loss, or exposure of sensitive data', 6),
    ('Market Conduct', 'Unfair trading, market manipulation, or anti-competitive behaviour', 7),
    ('Money Laundering / Terrorist Financing', 'ML/TF exposure, inadequate AML/CFT controls', 8),
    ('Sanctions Violation', 'Breach of international sanctions or trade embargoes', 9),
    ('Consumer Protection', 'Harm to consumers, unfair treatment, or mis-selling', 10),
    ('Strategic Risk', 'Misalignment with regulatory direction or industry trends', 11),
    ('Credit / Counterparty', 'Exposure to defaulting counterparties or credit concentration', 12),
    ('Liquidity / Funding', 'Inability to meet short-term obligations or fund operations', 13),
    ('Systemic / Contagion', 'Risk of cascading failure through the financial system', 14)
ON CONFLICT (name) DO NOTHING;
