-- Premium sellers get 10 free boosts per month (was 5)
UPDATE premium_boost_credits
SET credits_total = 10
WHERE credits_total < 10;
