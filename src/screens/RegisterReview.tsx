import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, addReview, createProduct, uploadPhoto, type Category } from '../db/db';
import { useProduct, useRefreshAfterWrite } from '../db/queries';
import { Chip, GlassButton, ReceiptHeader, ReceiptScreen, StarRating } from '../design/ReceiptScreen';
import { PerforationLine, ReceiptPaper } from '../design/parts';
import { Icon } from '../design/Icon';
import { ProductPhoto } from '../lib/photo';
import { clearPendingPhoto, peekPendingPhoto } from '../lib/pendingPhoto';
import { primeFeedSound } from '../lib/feedSound';

const SUGGESTED_KEYWORDS = [
  '국물이 진해요',
  '가성비',
  '해장용',
  '재구매',
  '자극적',
  '매워요',
  '달아요',
  '양이 많아요',
];

/** S06 등록 + 리뷰.
 *
 * 디자인에 "이미 등록된 제품에 리뷰만 추가"하는 화면이 없다. 화면을 새로 그리는 대신
 * 이 뷰를 두 모드로 쓴다 — 제품 정보 블록만 접었다 폈다 한다. */
export function RegisterReview() {
  const { barcode = '' } = useParams();
  const navigate = useNavigate();

  // undefined = 아직 조회 중, null = 없는 제품. 등록 플로우가 이 둘을 구분해야 한다.
  const { data: product } = useProduct(barcode);
  const refresh = useRefreshAfterWrite();
  const photo = peekPendingPhoto(barcode);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('라면');
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  // 신규 등록인데 촬영 결과가 없으면(뒤로가기·새로고침) 사진 화면으로 돌려보낸다.
  const registering = !product;
  useEffect(() => {
    if (product === undefined) return; // 아직 조회 중
    if (registering && !photo) navigate(`/p/${barcode}/photo`, { replace: true });
  }, [product, registering, photo, barcode, navigate]);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategory(product.category);
    }
  }, [product]);

  const canSave = rating > 0 && (!registering || name.trim().length > 0);

  async function save() {
    if (!canSave || saving) return;
    setSaving(true);

    try {
      if (registering && photo) {
        const photoPath = await uploadPhoto(barcode, photo.blob);
        await createProduct({
          barcode,
          name: name.trim(),
          category,
          photoPath,
          photoIsCutout: photo.isCutout,
        });
        clearPendingPhoto();
      }

      await addReview(barcode, { rating, body: body.trim(), keywords });
    } catch (error) {
      // 서버에 못 올렸으면 화면을 넘기지 않는다 — 넘겨버리면 저장된 줄 알고 떠난다
      setSaveError(error instanceof Error ? error.message : '저장하지 못했어요.');
      setSaving(false);
      return;
    }
    refresh(barcode);
    // 저장이 끝나면 등록 플로우 전체를 히스토리에서 걷어낸다.
    if (registering) {
      // 새로 등록한 제품은 그 카테고리로 보내 프린터에서 바로 뽑혀 나오게 한다.
      // 소리는 이 클릭 안에서 깨워둬야 한다 — 자동재생 정책상 화면을 옮긴 뒤에는 늦다.
      void primeFeedSound();
      navigate(`/c/${category}`, { replace: true, state: { printed: barcode } });
    } else {
      navigate(`/p/${barcode}`, { replace: true });
    }
  }

  function toggleKeyword(keyword: string) {
    setKeywords((current) =>
      current.includes(keyword)
        ? current.filter((k) => k !== keyword)
        : current.length < 3
          ? [...current, keyword]
          : current,
    );
  }

  if (product === undefined) return <ReceiptScreen>{null}</ReceiptScreen>;

  return (
    <ReceiptScreen>
      <ReceiptPaper>
        <div className="pad" style={{ paddingBottom: 26 }}>
          <ReceiptHeader
            title="Review"
            trailingIcon="xmark"
            onAction={() => {
              clearPendingPhoto();
              navigate('/', { replace: true });
            }}
          />

          <div style={{ height: 20 }} />
          <PerforationLine />
          <div style={{ height: 20 }} />

          {registering && photo ? (
            <>
              <div className="feed-meta">
                <div>
                  <div
                    className="mono"
                    style={{
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: 2.2,
                      color: 'var(--pink)',
                    }}
                  >
                    NEW ITEM
                  </div>
                  <div style={{ height: 5 }} />
                  <div
                    className="mono"
                    style={{ fontSize: 13, letterSpacing: 0.8, color: 'var(--ink2)' }}
                  >
                    {barcode}
                  </div>
                </div>
                <Icon name="checkmark.seal.fill" size={18} color="var(--icon-pink)" />
              </div>

              <div style={{ height: 20 }} />

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <ProductPhoto src={photo.url} width={96} height={96} radius={8} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* 폴백으로 처리됐으면 솔직하게 말한다. "지워집니다" 예고와 어긋나면 배신감이 든다. */}
                  <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
                    {photo.isCutout ? '배경이 제거된 사진이에요' : '배경은 그대로 두었어요'}
                  </span>
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      alignSelf: 'flex-start',
                      padding: '7px 13px',
                      borderRadius: 'var(--r-full)',
                      background: 'var(--ink-glass)',
                      boxShadow: 'inset 0 0 0 1px var(--ink-glass-edge)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--ink2)',
                    }}
                    onClick={() => navigate(`/p/${barcode}/photo`, { replace: true })}
                  >
                    <Icon name="arrow.counterclockwise" size={11} color="var(--icon-ink)" />
                    다시 찍기
                  </button>
                </div>
              </div>

              <div style={{ height: 22 }} />

              <div className="field-label">제품명 *</div>
              <input
                className="underline-input"
                placeholder="예) 대파 육개장면"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />

              <div style={{ height: 22 }} />

              <div className="field-label">CATEGORY *</div>
              <div style={{ height: 10 }} />
              <div className="chips">
                {CATEGORIES.map((item) => (
                  <Chip
                    key={item}
                    title={item}
                    selected={category === item}
                    onClick={() => setCategory(item)}
                  />
                ))}
              </div>
            </>
          ) : (
            product && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <ProductPhoto path={product.photoPath} width={72} height={72} radius={8} />
                <div>
                  <div className="field-label">{product.category}</div>
                  <div style={{ height: 5 }} />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{product.name}</div>
                </div>
              </div>
            )
          )}

          <div style={{ height: 26 }} />
          <PerforationLine />
          <div style={{ height: 22 }} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StarRating rating={rating} size={34} spacing={7} onSelect={setRating} />
          </div>

          <div style={{ height: 20 }} />

          <div className="editor">
            <textarea
              placeholder={'어떤 점이 좋았나요?\n맛, 가격, 재구매 의사 등 솔직한 후기를 남겨주세요.'}
              value={body}
              maxLength={500}
              onChange={(event) => setBody(event.target.value.slice(0, 500))}
            />
            <span className="count">{body.length} / 500</span>
          </div>

          <div style={{ height: 20 }} />

          <div className="field-label">KEYWORD · 최대 3개</div>
          <div style={{ height: 10 }} />
          <div className="chips">
            {SUGGESTED_KEYWORDS.map((keyword) => (
              <Chip
                key={keyword}
                title={keyword}
                selected={keywords.includes(keyword)}
                onClick={() => toggleKeyword(keyword)}
              />
            ))}
          </div>

          <div style={{ height: 28 }} />

          <GlassButton
            icon="printer"
            title={saving ? '저장하는 중…' : registering ? '등록하기' : '리뷰 남기기'}
            fontSize={14.5}
            disabled={!canSave || saving}
            onClick={save}
          />

          {saveError && (
            <>
              <div style={{ height: 12 }} />
              <div className="center" style={{ fontSize: 12.5, color: 'var(--pink)' }}>
                {saveError}
              </div>
            </>
          )}
        </div>
      </ReceiptPaper>
    </ReceiptScreen>
  );
}
