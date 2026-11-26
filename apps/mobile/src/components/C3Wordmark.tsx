import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

const MARK =
  "M49.449 10.002A28 28 0 1 0 49.449 45.998A5 5 0 0 0 41.789 39.57A18 18 0 1 1 41.789 16.43A5 5 0 0 0 49.449 10.002ZM59.077 7.75A15.5 15.5 0 1 1 72.5 31A5 5 0 0 1 72.5 21A5.5 5.5 0 1 0 67.737 12.75A5 5 0 0 1 59.077 7.75ZM72.5 21A17.5 17.5 0 1 1 57.345 47.25A5 5 0 0 1 66.005 42.25A7.5 7.5 0 1 0 72.5 31A5 5 0 0 1 72.5 21ZM72.5 31H68.5A5 5 0 0 1 68.5 21H72.5Z";
const DOT = "M21.5 28a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0Z";

/** The C3 mark: a C around a dot, and a 3. */
export function C3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 90 / 56;
  return (
    <Svg
      accessibilityLabel="C3"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="0 0 90 56"
    >
      <ThemedPath
        d={MARK}
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
      <ThemedPath
        d={DOT}
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
