# CCM MUI Migration — Agent Briefing

You are migrating CCM frontend pages from **Ant Design + reactstrap** to **Material UI v9**.
The reference implementation is already done and APPROVED: `frontend/src/master/views/department-master.js`.
**Read that file first** — mirror its structure exactly.

## ABSOLUTE RULES (functional parity)
- Change ONLY the UI/JSX/imports layer. Do NOT change any:
  - API calls (`new CommonUtilityController().xxx()`), request payloads, field names
  - state shape, validation logic, duplicate-check logic, workflow/branching
  - `LoginState`, `moment` timestamps, `fillSelectList`, constants, controller methods
- Keep the class component + all methods. Only rewrite `render()`, the `columns`/`gridColumns`,
  the imports, and swap antd `Modal.error/success` → Snackbar+Alert via a `notify()` helper.
- Every field that was submitted before must still be submitted with the same key/value.

## DESIGN SYSTEM (import from barrel)
```js
import { PageContainer, PageHeader, DataCard, EmptyState, FormDialog, ConfirmDialog, AppDataGrid } from '../../components/ui';
```
Theme is global (SYSTRA: primary #2F3A67, secondary #D62828). Use MUI components + `sx`, no inline hex.

## MAPPING (old → new)
- Page wrapper `<div className="animated fadeIn...">` + reactstrap `<Card>` header → `<PageContainer>` + `<PageHeader title subtitle actions={...}>`
- The dark `#3b466f` header bar with title + count + buttons → `PageHeader` actions (buttons) and `DataCard title count`
- antd `<Table columns dataSource pagination scroll loading>` → `<AppDataGrid rows={data} columns={gridColumns} loading={loading} getRowId={(r)=>r.XxxId} emptyTitle emptyDescription>`
  - Convert each antd column `{title,key,dataIndex,sorter,...search}` → DataGrid `{field:dataIndex, headerName:title, flex/ minWidth}`. Numeric cols: `type:'number', align:'right', headerAlign:'right'`. Drop antd `getColumnSearchProps` (DataGrid toolbar quick-filter replaces it).
  - Action column → `renderCell` returning MUI `IconButton`s (EditRounded primary, DeleteRounded error) with `Tooltip`. Keep the `record.Status == "9"` disabled logic. Delete → open `ConfirmDialog` (do NOT call delete directly; mirror department's requestDelete/confirmDelete).
- antd `<Modal>` + `<Form>` (Ant) → `<FormDialog open title onClose actions={<Buttons/>}>` with MUI `<Grid container spacing>` of `<TextField>` / `<TextField select>` (parent dropdowns). Use controlled inputs bound to `state.xxxData` via a `handleField(field)` setter, and a `validateForm()` that reproduces the antd `rules={[{required:true}]}` requirements. Submit calls the ORIGINAL `handleSubmit(payload)` unchanged.
- antd `<Popconfirm>` → `ConfirmDialog`.
- antd `Modal.error/success` → `this.notify('error'|'success', msg)` + a `<Snackbar><Alert/></Snackbar>` (copy department's notify/closeSnackbar/snackbar state).
- MUI v9 Grid uses `size={{ xs:12, sm:6 }}` NOT `item xs`.

## view-* PAGES (read-only) SPECIFICS
- No New/Edit/Delete, no dialog, no form. Just PageContainer + PageHeader + DataCard + AppDataGrid.
- They ALSO render `<ReportPdfFooter columnHeader={this.columns} tableData={data} .../>`. This needs antd-shaped
  `{title, key}` columns. So KEEP the original `this.columns` array (used ONLY for ReportPdfFooter) and ADD a separate
  `gridColumns` for AppDataGrid. Do not break ReportPdfFooter.

## DataGrid v9 GOTCHA
Never render a bare `GridToolbarQuickFilter`. AppDataGrid already handles the toolbar via `showToolbar`. Just use AppDataGrid.

## VERIFY
After editing your batch, ensure imports resolve and JSX is valid. A production build will be run centrally at the end.
Report: which files you changed, and any page that had an unusual pattern you had to adapt.
