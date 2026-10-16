// Web (and unit tests): the menu overlay sits inside the page, no system bars.
export function useMenuInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
