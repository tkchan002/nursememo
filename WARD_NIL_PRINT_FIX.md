# Ward Memo: NIL consultation/intubation X marks

## What was wrong

The Ward PDF/print HTML correctly marks the consultation and intubation table
containers with `crossed` when their NIL checkboxes are selected. The X is an
SVG overlay over the table body, deliberately excluding the column headings.
The SVG starts at height zero until a layout function measures the table.

The iframe preview invoked that function. The separate `print.html` screen
(created by `printWardMemo`) did not, leaving a zero-height X in the printout.

## Fix

- `services/ward-memo-crosses.js` contains one shared layout function.
- `ward-print.js` calls it for the embedded preview.
- `print.js` calls it when first displaying the print page, before printing,
  on viewport changes, and after images/fonts may have changed table dimensions.
- A selected NIL checkbox crosses the table body, not the headings.
- Without NIL selected, patient/consultation/intubation rows print normally.
- The selected report cycle continues to control PM Memo vs Night Memo heading.

## Deployment

Replace the repository files with the updated ZIP and deploy GitHub Pages.
There is no change to Supabase tables, account roles, passwords, or Edge Functions.
If the old print page remains cached after deployment, hard-refresh the new site
and open a *new* print/preview from `ward.html`.

## How to verify manually

1. Open a Ward memo, select `Nil Consultation` and `Nil Intubation`, then open
   Print/PDF. Both empty table bodies should show an X; headers stay readable.
2. Clear only `Nil Consultation`. Its table must no longer be crossed; the
   intubation table should still show the X.
3. Swap the selections. Confirm only consultation is crossed.
4. Clear both checkboxes and add a sample entry; confirm the data is printed
   and neither table has an X.
5. Repeat for both PM Memo and Night Memo, including Save as PDF.

## Verification status

Source syntax/import/test suite passes. Automated tests exercise the output
markup and measured layout function. A full browser-mediated PDF rendering test
was not completed in this environment, so confirm the five steps above after
deployment.

## Default NIL checkbox state

In a new Ward PM Memo or Night Memo, **Nil Consultation** and **Nil Intubation** now start unchecked. Staff must select the relevant NIL option explicitly to cross out the consultation or intubation table when printing.

Saved drafts and reports keep their stored checkbox values, including `true` selections. **Nil Special** is unchanged. This is an application-only update: no Supabase SQL, account or Edge Function changes are required.
