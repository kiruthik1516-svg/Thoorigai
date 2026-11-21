import { redirect } from 'next/navigation'

/** /settings has no page of its own; send people to their own settings instead of a 404. */
export default function SettingsIndexPage() {
  redirect('/settings/user')
}
