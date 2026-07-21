# Ant Design → MUI Complete Migration Plan

## Goal
Remove ALL antd imports from the codebase. After migration, `antd`, `@ant-design/icons`, `@coreui/react`, `reactstrap`, and `bootstrap` can be deleted from `package.json`.

---

## Inventory: 24 files still importing antd

### Tier 1 — Trivial (1-2 antd imports, just `Modal.error`)
| File | antd usage | Strategy |
|------|-----------|----------|
| `redux/actions/common-action.js` (22 lines) | `Modal.error()` | Replace with `console.error()` |
| `ccm/views/dashboard.js` (278 lines) | `Modal` import (unused) | Delete import |
| `helper/file-viewer.js` (40 lines) | `Button` import (dead code) | Delete import |
| `helper/file-helper.js` (46 lines) | `Modal` (declarative) | Replace with MUI Dialog |

### Tier 2 — Low effort (Modal replacement only)
| File | antd usage | Strategy |
|------|-----------|----------|
| `containers/default-layout/external-layout.js` (372 lines) | `Modal` (declarative) | MUI Dialog |
| `containers/default-layout/external-header.js` (177 lines) | `Modal` (declarative) | MUI Dialog |
| `containers/default-layout/modern-header.js` (222 lines) | `Modal` (declarative) | MUI Dialog |
| `ccm/views/ai-drafting.js` (663 lines) | `antdMessage`, `Modal` | MUI Snackbar + Dialog |
| `master/controller/base-controller.js` (159 lines) | `Modal.error()` × 3 | Simple redirect-to-login on 401 (no modal needed) |

### Tier 3 — Medium effort (Button/Tooltip/Icon replacements)
| File | antd usage | Strategy |
|------|-----------|----------|
| `helper/report-pdf-footer.js` (165 lines) | `Button`, `Tooltip`, icons | MUI Button/Tooltip + MUI icons |
| `helper/report-html-pdf-footer.js` (207 lines) | `Button`, icon | MUI Button + MUI icon |
| `helper/pdf-viewer.js` (66 lines) | `Modal`, `Button`, icons | MUI Dialog/Button/icons |
| `helper/pdf-card-viewer.js` (96 lines) | `Tooltip`, `Button`, icons | MUI Tooltip/Button/icons |
| `helper/image-viewer.js` (34 lines) | `Image`, `Modal`, `Button` | MUI Dialog + `<img>` |
| `master/common/quality-file-upload.js` (268 lines) | `Button`, `Form`, `Upload`, `Row/Col`, `Modal`, `Spin`, `Image`, `Input`, icon | MUI form + native `<input type="file">` |

### Tier 4 — High effort (cross-cutting shared helpers)
| File | antd usage | Strategy |
|------|-----------|----------|
| `helper/common-utility.js` (156 lines) | `Select.Option`, `Radio` | Rewrite `fillSelectList()` to return plain `{value, label}[]` arrays; rewrite `fillRadioList()` similarly. Remove dead `designationList` state from all consumers. |
| `helper/constants.js` (242 lines) | Uses `fillSelectList` → antd Option arrays | After common-utility fix, these become plain arrays — no change needed |
| `helper/table-helper.js` (265 lines) | `Input`, `InputNumber`, `Button`, `Form`, `Space`, `Select`, `Switch`, `SearchOutlined` | Rewrite `TableHelper` search/filter to use MUI TextField + icons. `EditableCell` stays until monthly-breakup is migrated. |
| `helper/edit-table-helper.js` (495 lines) | `Table`, `Input`, `Form`, `Button`, `Select`, `Popconfirm`, `Switch`, `Modal`, `Tooltip`, icons | Full rewrite to MUI DataGrid or custom editable table |
| `helper/form-helper.js` (128 lines) | Exports antd layout constants (`layout`, `tailLayout`, etc.) | Remove antd-specific exports; keep `validateMessages`-like logic for MUI forms |
| `authentication/login.js` (304 lines) | `Space`, `Card`, `Button`, `Row/Col`, `Modal`, `Tooltip`, `Form`, `Input`, `Spin`, `Typography`, icons | Full rewrite: MUI Card + Stack/Grid + TextField + Button + CircularProgress |

### Tier 5 — Complex master view forms (partially migrated)
| File | antd usage | Strategy |
|------|-----------|----------|
| `master/views/modify-monthly-breakup-master.js` (304 lines) | `Form` only | Replace antd `Form` wrapper with `<form>` or MUI Box/Stack |
| `master/views/project-master-details.js` (671 lines) | `Form`, `Input`, `Spin`, `Select`, `DatePicker`, `InputNumber`, `Row/Col` | Replace all form controls with MUI equivalents |
| `master/views/activity-master.js` (953 lines) | `DatePicker`, `Form`, `Button`, `Row/Col`, `Input`, `Spin`, `InputNumber`, `Select`, `Switch`, icon | Replace all form controls with MUI equivalents |
| `master/views/project-master.js` (763 lines) | `Form`, `Input`, `Spin`, `Divider`, `Select`, `Tabs/TabPane`, `Image`, `InputNumber`, `Row/Col` | Replace form + antd Tabs with MUI Tabs/TabPanel |
| `master/views/monthly-breakup-master.js` (545 lines) | `Form`, `Input`, `Select`, `Row/Col`, `Button`, `Table`, `Popconfirm`, `InputNumber`, `DatePicker`, icons + `EditableCell` helper | Full rewrite: MUI DataGrid with custom editable cells, or inline TextFields in a MUI Table |

---

## Execution Order (6 phases)

### Phase 1: Shared Infrastructure (unblocks everything else)
**Files:** `common-utility.js`, `constants.js`, `table-helper.js`, `edit-table-helper.js`, `form-helper.js`, `base-controller.js`, `redux/actions/common-action.js`

1. **`common-utility.js`**: Replace `fillSelectList()` to return `[{value, label}]` arrays instead of antd `<Option>` JSX. Replace `fillRadioList()` similarly. Remove `Select`/`Radio` imports.
2. **`constants.js`**: After step 1, the pre-computed lists become plain arrays — no changes needed.
3. **Clean dead code**: Remove `fillSelectList` calls and `*List` state from ALL already-migrated master views (designation, role, user, department, location, unit, module, module-group, reference-document, activity-group) — these store antd `<Option>` arrays in state but never render them (they use `data.map()` with MUI `MenuItem`).
4. **`base-controller.js`**: Remove `Modal.error` + reactstrap `Modal` session-expiry dialog. Replace with simple `window.location.href = '/login'` redirect on 401 (or `new SessionExpire().logOut()`).
5. **`redux/actions/common-action.js`**: Replace `Modal.error` with `console.error`.
6. **`table-helper.js`**: Rewrite `TableHelper` class — replace antd `Input`/`Select`/`Switch`/`Form`/`Button`/`SearchOutlined` with MUI equivalents for the search/filter column helpers. Keep `EditableCell` export temporarily (used by monthly-breakup). Keep `Pagination` and `Scroll` exports.
7. **`edit-table-helper.js`**: Full rewrite to MUI DataGrid with editable cells, or custom MUI table with inline editing.
8. **`form-helper.js`**: Remove all antd-specific layout exports (`layout`, `tailLayout`, `verticallayout`, `itemLayout`, `itemLayoutForPreMigitation`, `selectSearch`, `selectSearchForLookupID`). Keep non-antd exports (`validateMessages` concept, lengths, `modalStyle`/etc which are already responsive).

### Phase 2: Layout & Auth (app shell)
**Files:** `external-layout.js`, `external-header.js`, `modern-header.js`, `login.js`

1. **`external-layout.js`**: Replace antd `Modal` with MUI `Dialog` (used for session-expired overlay).
2. **`external-header.js`**: Replace antd `Modal` with MUI `Dialog`.
3. **`modern-header.js`**: Replace antd `Modal` with MUI `Dialog`.
4. **`login.js`**: Full rewrite — replace antd `Space`/`Card`/`Button`/`Row`/`Col`/`Modal`/`Tooltip`/`Form`/`Input`/`Spin`/`Typography` + icons with MUI equivalents. Use MUI `Card` + `Stack` + `TextField` + `Button` + `CircularProgress` + icons.

### Phase 3: PDF/File/Report Viewers
**Files:** `report-pdf-footer.js`, `report-html-pdf-footer.js`, `pdf-viewer.js`, `pdf-card-viewer.js`, `image-viewer.js`, `file-viewer.js`, `file-helper.js`, `quality-file-upload.js`

1. **`file-viewer.js`**: Delete dead antd import (line with `Button` from antd).
2. **`file-helper.js`**: Replace `Modal` with MUI `Dialog`.
3. **`report-html-pdf-footer.js`**: Replace `Button` + icon with MUI `Button` + icon.
4. **`report-pdf-footer.js`**: Replace `Button`/`Tooltip` + icons with MUI equivalents.
5. **`pdf-viewer.js`**: Replace `Modal`/`Button` + icons with MUI Dialog/Button/icons.
6. **`pdf-card-viewer.js`**: Replace `Tooltip`/`Button` + icons with MUI equivalents.
7. **`image-viewer.js`**: Replace `Image`/`Modal`/`Button` with MUI Dialog + `<img>`.
8. **`quality-file-upload.js`**: Replace `Button`/`Form`/`Upload`/`Row`/`Col`/`Modal`/`Spin`/`Image`/`Input` + icon with MUI form + native file input.

### Phase 4: Feature Views
**Files:** `dashboard.js`, `ai-drafting.js`

1. **`dashboard.js`**: Remove unused `Modal` import.
2. **`ai-drafting.js`**: Replace `antdMessage` with MUI Snackbar, replace `Modal` with MUI Dialog.

### Phase 5: Complex Master View Forms
**Files:** `modify-monthly-breakup-master.js`, `project-master-details.js`, `activity-master.js`, `project-master.js`, `monthly-breakup-master.js`

1. **`modify-monthly-breakup-master.js`**: Replace single `Form` wrapper with `<form>` element.
2. **`project-master-details.js`**: Replace antd `Form`/`Input`/`Spin`/`Select`/`DatePicker`/`InputNumber`/`Row`/`Col` with MUI `TextField`/`Select`/`DatePicker` (MUI X)/`Stack`/`Grid`/`CircularProgress`.
3. **`activity-master.js`**: Same pattern as above — replace all antd form controls.
4. **`project-master.js`**: Replace antd `Tabs`/`TabPane` with MUI `Tabs`/`TabPanel`, plus all form controls.
5. **`monthly-breakup-master.js`**: Full rewrite — replace antd editable `Table` with custom inline-editable MUI table (TextFields in table cells). Replace parent `Form` with MUI form controls. Replace `Popconfirm` with `ConfirmDialog`.

### Phase 6: Cleanup
1. Remove `antd`, `@ant-design/icons`, `@coreui/react`, `reactstrap`, `bootstrap` from `package.json`.
2. Remove any `antd/dist/` CSS imports (e.g., `@import 'antd/dist/reset.css'` in `app.css`).
3. Remove antd-specific CSS overrides in `app.css` (`.ant-*` selectors).
4. Run `npm run build` — verify zero errors.
5. Grep for any remaining `from 'antd'` or `from '@ant-design` — should return zero results.

---

## Key Design Decisions

### `fillSelectList` migration
**Current:** Returns `[<Option value={v}>{t}</Option>]` — antd-specific JSX.
**New:** Returns `[{ value: obj[value], label: obj[text] }]` — plain data arrays.
**Impact:** Every consumer that renders antd `<Select>{fillSelectList(...)}</Select>` needs to change to MUI `<TextField select>{options.map(o => <MenuItem value={o.value}>{o.label}</MenuItem>)}</TextField>`. But the already-migrated files DON'T actually render these — they use `data.map()` directly. So we just delete the dead `fillSelectList` calls from migrated files.

### `base-controller.js` session expiry
**Current:** `modal.error({ content: <Modal>...</Modal> })` — nests reactstrap Modal inside antd Modal.error. Ugly but works.
**New:** On 401, call `new SessionExpire().logOut()` which redirects to login. No modal needed.

### `table-helper.js` search/filter
The `TableHelper.getColumnSearchProps()` method returns antd-specific filter dropdown props for `<Table.Column>`. Since migrated files use MUI `AppDataGrid` with built-in `showToolbar` quick-filter, these props are only needed by non-migrated files. After migration, the entire `TableHelper` class can be simplified or removed.

### `monthly-breakup-master.js` editable table
The antd `Table` with `EditableCell` is the hardest pattern. Strategy: Replace with a custom MUI `Table` where each cell renders a `TextField` in edit mode. The save/cancel logic stays the same, just the rendering changes.

---

## Verification
After each phase: `npm run build` (must succeed with 0 errors).
After Phase 6: `grep -r "from 'antd'" src/` must return 0 results. `grep -r "from '@ant-design" src/` must return 0 results.
