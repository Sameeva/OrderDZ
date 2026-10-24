import { fmtDA } from "./format";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Rolling price. Each digit is a column of 0-9 moved with a CSS transform transition (spring
 * easing from --spring), so it runs on the compositor and retargets smoothly if the value
 * changes mid-roll. Columns are keyed from the right so a digit keeps its column when the number
 * grows. The visible strips are aria-hidden; screen readers get the plain text.
 */
export function Odometer({ centimes }: { centimes: number }) {
  const text = fmtDA(centimes).replace(/[ ]DA$/, "");
  const chars = [...text];
  return (
    <span className="od">
      <span className="sr-only">{fmtDA(centimes)}</span>
      <span aria-hidden="true" className="od-row">
        {chars.map((ch, i) => {
          const fromRight = chars.length - 1 - i;
          return /\d/.test(ch) ? (
            <span className="od-cell" key={`d${fromRight}`}>
              <span className="od-strip" style={{ "--d": Number(ch) } as React.CSSProperties}>
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          ) : (
            <span className="od-sep" key={`s${fromRight}`}>
              {ch}
            </span>
          );
        })}
        <span className="od-unit">DA</span>
      </span>
    </span>
  );
}
