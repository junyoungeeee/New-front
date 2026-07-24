-- New. — Supabase 스키마
-- 대시보드 SQL Editor 에 그대로 붙여넣고 실행한다. 여러 번 돌려도 안전하다.
--
-- 익명 로그인(Authentication → Providers → Anonymous sign-ins)을 켜두면 리뷰에
-- 작성자가 붙어 나중에 본인 글을 고치거나 지울 수 있다. 꺼져 있어도 앱은 돌아간다 —
-- 그 경우 author_id 가 비고, 수정·삭제 정책이 아무에게도 걸리지 않을 뿐이다.

-- ─────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────

-- barcode 를 자연키로 쓴다. UUID 를 주키로 두면 같은 제품이 사람마다 다른 행으로
-- 생겨 병합이 지옥이 된다 (docs/MVP-web.md §8).
create table if not exists public.products (
  barcode         text primary key,
  name            text not null check (length(trim(name)) > 0),
  category        text not null check (category in ('라면','과자','음료','아이스크림','커피','기타')),
  -- 스토리지 객체 키(`<바코드>.webp`) 또는 정적 경로(`/seed/daepa-ramen.png`)
  photo_path      text,
  photo_is_cutout boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  barcode    text not null references public.products(barcode) on delete cascade,
  author_id  uuid default auth.uid(),
  rating     int  not null check (rating between 1 and 5),
  body       text not null default '',
  keywords   text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists products_category_created_idx
  on public.products (category, created_at desc);
create index if not exists reviews_barcode_created_idx
  on public.reviews (barcode, created_at desc);

-- ─────────────────────────────────────────────
-- RLS — anon 키는 공개된다. 데이터를 지키는 건 이 정책뿐이다.
-- ─────────────────────────────────────────────

alter table public.products enable row level security;
alter table public.reviews  enable row level security;

drop policy if exists "제품 읽기" on public.products;
create policy "제품 읽기" on public.products
  for select to anon, authenticated using (true);

-- 등록은 누구나. 다만 한 번 올라간 제품은 아무도 고치거나 지울 수 없다 —
-- update/delete 정책을 아예 만들지 않으면 RLS 가 전부 막는다.
drop policy if exists "제품 등록" on public.products;
create policy "제품 등록" on public.products
  for insert to anon, authenticated with check (true);

drop policy if exists "리뷰 읽기" on public.reviews;
create policy "리뷰 읽기" on public.reviews
  for select to anon, authenticated using (true);

drop policy if exists "리뷰 쓰기" on public.reviews;
create policy "리뷰 쓰기" on public.reviews
  for insert to anon, authenticated with check (true);

-- 본인 글만. 익명 로그인이 꺼져 있으면 auth.uid() 가 null 이라 아무에게도 걸리지 않는다.
drop policy if exists "내 리뷰 수정" on public.reviews;
create policy "내 리뷰 수정" on public.reviews
  for update to authenticated using (author_id = auth.uid());

drop policy if exists "내 리뷰 삭제" on public.reviews;
create policy "내 리뷰 삭제" on public.reviews
  for delete to authenticated using (author_id = auth.uid());

-- ─────────────────────────────────────────────
-- 스토리지 — 제품 사진
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "사진 읽기" on storage.objects;
create policy "사진 읽기" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-photos');

drop policy if exists "사진 올리기" on storage.objects;
create policy "사진 올리기" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'product-photos');

-- ─────────────────────────────────────────────
-- 시드 — 카메라 없이도 화면을 확인할 수 있게 (기존 로컬 시드와 같은 내용)
-- 사진은 앱에 이미 들어 있는 정적 파일을 가리킨다. 스토리지에 올릴 필요가 없다.
-- ─────────────────────────────────────────────

insert into public.products (barcode, name, category, photo_path, photo_is_cutout, created_at) values
  ('8809778499663', '대파 육개장면', '라면', '/seed/daepa-ramen.png', true,  now() - interval '3 days'),
  ('8801045833934', '제주 똣똣라면', '라면', '/seed/jeju-ramen.png',  true,  now() - interval '3 days')
on conflict (barcode) do nothing;

insert into public.reviews (barcode, rating, body, keywords, created_at)
select * from (values
  ('8809778499663', 5, E'대파 향이 진짜 진해요.\n국물이 칼칼하고 시원합니다!', array['국물이 진해요','해장용'], now() - interval '5 days'),
  ('8809778499663', 4, E'육개장 국물에 대파가 듬뿍이라\n해장으로 딱이에요.',     array['해장용'],                 now() - interval '12 days'),
  ('8809778499663', 5, E'면발이 쫄깃하고 대파블럭이 실해요.\n재구매 의사 100%입니다!', array['재구매'],           now() - interval '21 days'),
  ('8809778499663', 3, E'생각보다 안 맵고 순한 편이에요.\n계란 풀어 먹으면 더 맛있어요.', array[]::text[],        now() - interval '30 days'),
  ('8801045833934', 4, E'국물이 담백하고 깔끔해요.\n짜지 않아서 좋았습니다.',     array['가성비'],                 now() - interval '3 days'),
  ('8801045833934', 5, E'제주 느낌 물씬 나는 맛이에요.\n선물용으로도 괜찮아요.',   array['재구매'],                 now() - interval '9 days')
) as seed(barcode, rating, body, keywords, created_at)
where not exists (select 1 from public.reviews);
