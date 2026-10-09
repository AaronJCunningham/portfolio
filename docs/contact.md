# Contact

The dedicated `/contact` page introduces freelance development, creative collaborations, and podcast appearances. Visitors contact Aaron directly through `mailto:info@aaronjcunningham.com`.

The public email address is defined once in `src/config/contact.ts` and used by the Contact page, shared footer, Impressum, and privacy page. The main menu and other project enquiry links still lead to `/contact`.

The contact form, `/api/contact` endpoint, Nodemailer dependencies, form tests, and SMTP example configuration have been removed. The site no longer sends contact mail or requires SMTP credentials. Existing private environment settings were left untouched.

The `info@aaronjcunningham.com` address must be configured in Google Workspace to receive messages. Website changes do not create the alias, change Google/YouTube contact settings, or verify email delivery. No email was sent during validation.
