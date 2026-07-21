type Props = {
  slotKey: string;
};

/** AdMob native/video ads are not available on web. */
export function FeedGoogleVideoAdNative(_props: Props): null {
  return null;
}
