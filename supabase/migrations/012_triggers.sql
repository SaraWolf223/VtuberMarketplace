-- Local Marketplace: triggers and helper functions
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION listings_set_lifecycle_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
    NEW.expires_at := NEW.published_at + INTERVAL '14 days';
    NEW.purge_at := NEW.published_at + INTERVAL '21 days';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION listings_set_sold_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM 'sold') THEN
    NEW.sold_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION profiles_listing_count_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    UPDATE profiles SET listing_count = listing_count + 1 WHERE id = NEW.seller_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status <> 'draft' THEN
    UPDATE profiles SET listing_count = GREATEST(listing_count - 1, 0) WHERE id = OLD.seller_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'draft' AND NEW.status <> 'draft' THEN
      UPDATE profiles SET listing_count = listing_count + 1 WHERE id = NEW.seller_id;
    ELSIF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
      UPDATE profiles SET listing_count = GREATEST(listing_count - 1, 0) WHERE id = NEW.seller_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_prefs_set_updated_at
  BEFORE UPDATE ON user_prefs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER listings_lifecycle_dates
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_set_lifecycle_dates();

CREATE TRIGGER listings_sold_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_set_sold_at();

CREATE TRIGGER listings_listing_count
  AFTER INSERT OR UPDATE OR DELETE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION profiles_listing_count_delta();

CREATE TRIGGER premium_subscriptions_set_updated_at
  BEFORE UPDATE ON premium_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
