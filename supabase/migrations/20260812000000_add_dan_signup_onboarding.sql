-- DAN-аар шинээр бүртгүүлсэн хэрэглэгч Нөхцөл зөвшөөрсөн цаг болон
-- анхны утас / нууц үгийн тохиргоогоо дуусгасан эсэхийг тусад нь тэмдэглэнэ.
-- Иргэний регистр, хаяг зэрэг хувийн мэдээлэл энд хадгалагдахгүй.

alter table public.users
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists dan_onboarding_completed_at timestamptz;

alter table public.dan_auth_states
  add column if not exists terms_accepted_at timestamptz;

-- Өмнө нь утасны дугаартай байсан, DAN-д аль хэдийн холбогдсон account-ууд
-- дахин onboarding хийх шаардлагагүй.
update public.users as u
set dan_onboarding_completed_at = coalesce(di.verified_at, u.created_at, now())
from public.dan_identities as di
where di.user_id = u.id
  and u.dan_onboarding_completed_at is null
  and u.phone ~ '^\+976[0-9]{8}$';
;
