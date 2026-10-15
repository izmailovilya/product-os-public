const paths = {
  segment: '<circle cx="12" cy="12" r="7.5"/><path d="M5.2 9.2c3.8 1.2 7.9 1.2 13.6 0M6 15.8c3.5-1.1 7.2-1.1 12 0"/><path d="M12 4.5c2.1 2 3.2 4.5 3.2 7.5S14.1 17.5 12 19.5"/>',
  map: '<path d="m4.5 6.5 5-2 5 2 5-2v13l-5 2-5-2-5 2v-13Z"/><path d="M9.5 4.5v13M14.5 6.5v13"/>',
  list: '<path d="M9 6h10M9 12h10M9 18h10"/><rect x="4" y="5" width="2" height="2" rx=".4"/><rect x="4" y="11" width="2" height="2" rx=".4"/><rect x="4" y="17" width="2" height="2" rx=".4"/>',
  fleet: '<rect x="3.5" y="5" width="7" height="14" rx="1.5"/><rect x="13.5" y="5" width="7" height="14" rx="1.5"/><path d="M6 9h2M16 9h2M6 12.5h2M16 12.5h2"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  back: '<path d="m10 6-6 6 6 6M4 12h16"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18c4.5 0 3.5-12 10-12"/>',
  reset: '<path d="M6.2 7.2A8 8 0 1 1 4 12"/><path d="M4 5v5h5"/>',
  evidence: '<path d="M4 17.5V20h2.5M17.5 20H20v-2.5M20 6.5V4h-2.5M6.5 4H4v2.5"/><circle cx="12" cy="12" r="3"/>',
  alert: '<path d="M12 4 21 19H3L12 4Z"/><path d="M12 9v4.5M12 16.5v.2"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
  source: '<path d="M8 5H5v14h14v-3M11 13 20 4M14 4h6v6"/>',
}

export function iconMarkup(name, className = '') {
  const body = paths[name] || paths.alert
  return `<svg class="galaxy-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`
}

export function installGalaxyIcons(root = document) {
  root.querySelectorAll('[data-galaxy-icon]').forEach(element => {
    element.innerHTML = iconMarkup(element.dataset.galaxyIcon)
  })
}

export const galaxyIconNames = Object.freeze(Object.keys(paths))

window.ProductOsIcons = Object.freeze({ iconMarkup, installGalaxyIcons, names: galaxyIconNames })
