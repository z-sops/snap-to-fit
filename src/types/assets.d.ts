// Metro resolves image imports to an asset id; Vite (tests) to a URL string.
declare module "*.png" {
  import type { ImageSourcePropType } from "react-native";
  const source: ImageSourcePropType;
  export default source;
}
