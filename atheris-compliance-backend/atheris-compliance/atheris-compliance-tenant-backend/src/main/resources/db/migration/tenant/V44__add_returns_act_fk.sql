-- Ground a regulatory return to its governing act.
-- regulatory_returns.act_id stores the act's platform regulation id (acts.regulation_id), matching the
-- seed (RegulationSeedService) and ActService.returnCount; add the missing FK + index so nothing dangling
-- can be persisted. The returns table is created in V6 but acts in V35, so the constraint lives here.
ALTER TABLE regulatory_returns
    ADD CONSTRAINT fk_returns_act FOREIGN KEY (act_id) REFERENCES acts(regulation_id);

CREATE INDEX IF NOT EXISTS idx_returns_act ON regulatory_returns(act_id);
