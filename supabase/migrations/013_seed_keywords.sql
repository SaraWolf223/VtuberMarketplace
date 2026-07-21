-- Local Marketplace: banned keywords seed (20 terms)
INSERT INTO banned_keywords (keyword) VALUES
  ('weapon'),
  ('gun'),
  ('ammo'),
  ('knife'),
  ('drug'),
  ('weed'),
  ('cocaine'),
  ('vape'),
  ('tobacco'),
  ('cigarette'),
  ('alcohol'),
  ('beer'),
  ('wine'),
  ('counterfeit'),
  ('replica'),
  ('stolen'),
  ('prescription'),
  ('onlyfans'),
  ('escort'),
  ('shipping only')
ON CONFLICT (keyword) DO NOTHING;
