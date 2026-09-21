-- =====================================================================
--  Çiftliğim — PostgreSQL veritabanı şeması (v0.1)
--  Hedef: PostgreSQL 13+ (trim_scale için)
--  Tablo/sütun adları İngilizce, açıklamalar Türkçe.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- büyük/küçük harf duyarsız e-posta

-- ---------------------------------------------------------------------
--  ENUM tipleri
-- ---------------------------------------------------------------------
CREATE TYPE member_role      AS ENUM ('owner', 'manager', 'shepherd', 'viewer');
CREATE TYPE animal_sex       AS ENUM ('female', 'male', 'unknown');
CREATE TYPE animal_status    AS ENUM ('active', 'sold', 'dead', 'slaughtered', 'lost');
CREATE TYPE animal_location  AS ENUM ('pasture', 'barn', 'other');          -- mera / ahır / diğer
CREATE TYPE treatment_type   AS ENUM ('medication', 'injection', 'vaccine',
                                      'antiparasitic', 'vitamin', 'other'); -- ilaç / iğne / aşı / parazit / vitamin
CREATE TYPE ownership_type   AS ENUM ('owned', 'shared', 'leased_in', 'sharecropped', 'other');
                                      -- tam mülk / hisseli / kiracı / ortakçı / diğer
CREATE TYPE operation_type   AS ENUM ('tillage', 'sowing', 'fertilizing', 'spraying',
                                      'irrigation', 'harvest', 'other');
                                      -- sürüm / ekim / gübre / ilaçlama / sulama / hasat
CREATE TYPE ai_role          AS ENUM ('user', 'assistant', 'system');

-- =====================================================================
--  1. KULLANICI, İŞLETME, ROL
-- =====================================================================

CREATE TABLE users (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email          citext UNIQUE,
    phone          text UNIQUE,
    password_hash  text NOT NULL,
    full_name      text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
COMMENT ON TABLE users IS 'Uygulama kullanıcıları (sahip, çoban vb. hepsi burada).';

-- Bir kullanıcının birden çok işletmesi olabilir; bir işletmede birden çok kullanıcı olabilir.
CREATE TABLE farms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    created_by  uuid NOT NULL REFERENCES users(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE farms IS 'İşletme / çiftlik. Tüm veriler bir işletmeye bağlıdır.';

CREATE TABLE farm_members (
    farm_id     uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        member_role NOT NULL,
    invited_by  uuid REFERENCES users(id),
    joined_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (farm_id, user_id)
);
COMMENT ON TABLE farm_members IS 'Kim hangi işletmede hangi rolde. Sahip çobanı buradan atar.';

-- Sürü: işletme içindeki hayvan grupları. Çoban sürü bazında yetkilendirilir.
CREATE TABLE herds (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id     uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name        text NOT NULL,
    notes       text,
    UNIQUE (farm_id, name),
    UNIQUE (farm_id, id)   -- bileşik FK hedefi
);

CREATE TABLE herd_assignments (
    herd_id      uuid NOT NULL REFERENCES herds(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by  uuid REFERENCES users(id),
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (herd_id, user_id)
);
COMMENT ON TABLE herd_assignments IS 'Çobanın sorumlu olduğu sürüler. Çoban yalnızca bu sürülerdeki hayvanları görür ve kayıt ekler.';

-- =====================================================================
--  2. HAYVANCILIK
-- =====================================================================

CREATE TABLE species (
    id    smallint PRIMARY KEY,
    code  text UNIQUE NOT NULL,
    name  text NOT NULL
);

CREATE TABLE breeds (
    id          serial PRIMARY KEY,
    species_id  smallint NOT NULL REFERENCES species(id),
    name        text NOT NULL,
    UNIQUE (species_id, name)
);

CREATE TABLE animals (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id               uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    herd_id               uuid,
    species_id            smallint NOT NULL REFERENCES species(id),
    breed_id              int REFERENCES breeds(id),
    ear_tag               text,          -- küpe no (kameradan okunan). Köpek/eşekte boş olabilir
    microchip             text,
    name                  text,
    sex                   animal_sex NOT NULL DEFAULT 'unknown',
    birth_date            date,
    birth_date_estimated  boolean NOT NULL DEFAULT false,  -- doğum tarihi tahmini mi?
    mother_id             uuid REFERENCES animals(id),
    father_id             uuid REFERENCES animals(id),
    birth_event_id        uuid,          -- hangi doğumdan geldi (FK aşağıda)
    color_marks           text,
    photo_url             text,
    status                animal_status NOT NULL DEFAULT 'active',
    acquired_on           date,
    exited_on             date,          -- satış/ölüm/kesim tarihi
    notes                 text,
    created_by            uuid NOT NULL REFERENCES users(id),
    created_at            timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (farm_id, herd_id) REFERENCES herds(farm_id, id),
    CHECK (mother_id IS DISTINCT FROM id AND father_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX animals_farm_ear_tag_uq ON animals (farm_id, ear_tag) WHERE ear_tag IS NOT NULL;
CREATE INDEX animals_herd_idx ON animals (herd_id);
COMMENT ON COLUMN animals.birth_date IS 'Yaş saklanmaz; bu tarihten her sorguda hesaplanır (v_animals).';

-- Konum geçmişi: mera / ahır. Güncel konum = son kayıt.
CREATE TABLE animal_location_events (
    id           bigserial PRIMARY KEY,
    animal_id    uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    location     animal_location NOT NULL,
    since        timestamptz NOT NULL DEFAULT now(),
    notes        text,
    recorded_by  uuid NOT NULL REFERENCES users(id),
    recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ale_animal_since_idx ON animal_location_events (animal_id, since DESC);

-- Yavrulama olayları (anne üzerinden)
CREATE TABLE birth_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mother_id       uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    birth_date      date NOT NULL,
    offspring_count smallint NOT NULL CHECK (offspring_count >= 0),
    alive_count     smallint CHECK (alive_count >= 0),
    difficulty      text,              -- kolay / müdahaleli / sezaryen vb.
    notes           text,
    recorded_by     uuid NOT NULL REFERENCES users(id),
    recorded_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (alive_count IS NULL OR alive_count <= offspring_count)
);
CREATE INDEX birth_events_mother_idx ON birth_events (mother_id, birth_date DESC);
ALTER TABLE animals ADD CONSTRAINT animals_birth_event_fk
    FOREIGN KEY (birth_event_id) REFERENCES birth_events(id) ON DELETE SET NULL;

-- Tartım kayıtları (canlı ağırlık). Profilde son tartım tarihi ve kilosu gösterilir.
CREATE TABLE animal_weights (
    id           bigserial PRIMARY KEY,
    animal_id    uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    weighed_on   date NOT NULL DEFAULT current_date,
    weight_kg    numeric(7,2) NOT NULL CHECK (weight_kg > 0),
    notes        text,
    recorded_by  uuid NOT NULL REFERENCES users(id),
    recorded_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX animal_weights_animal_idx ON animal_weights (animal_id, weighed_on DESC);

-- İlaç kataloğu. farm_id NULL = herkese açık ortak katalog, dolu = işletmenin kendi eklediği.
CREATE TABLE medicines (
    id                     serial PRIMARY KEY,
    farm_id                uuid REFERENCES farms(id) ON DELETE CASCADE,
    name                   text NOT NULL,       -- ticari ad (ör. Ivomec)
    active_ingredient      text,                -- etken madde (ör. ivermektin)
    default_unit           text NOT NULL DEFAULT 'ml',
    meat_withdrawal_days   int CHECK (meat_withdrawal_days >= 0),  -- et arınma süresi (prospektüsten)
    milk_withdrawal_days   int CHECK (milk_withdrawal_days >= 0),  -- süt arınma süresi
    notes                  text
);
CREATE UNIQUE INDEX medicines_name_uq ON medicines (COALESCE(farm_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Hastalık kayıtları
CREATE TABLE illnesses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id    uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    diagnosis    text NOT NULL,        -- teşhis / belirti
    started_on   date NOT NULL,
    resolved_on  date,
    outcome      text,                 -- iyileşti / kronik / öldü ...
    vet_name     text,
    notes        text,
    recorded_by  uuid NOT NULL REFERENCES users(id),
    recorded_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (resolved_on IS NULL OR resolved_on >= started_on)
);
CREATE INDEX illnesses_animal_idx ON illnesses (animal_id, started_on DESC);

-- Tedavi / ilaç / aşı uygulamaları. Çobanın sahadan girdiği kayıt budur.
CREATE TABLE treatments (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id              uuid NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    illness_id             uuid REFERENCES illnesses(id) ON DELETE SET NULL,
    type                   treatment_type NOT NULL,
    medicine_id            int REFERENCES medicines(id),
    medicine_text          text,               -- katalogda yoksa serbest ad
    dose                   numeric(10,3) CHECK (dose > 0),
    dose_unit              text,               -- ml, mg, tablet...
    route                  text,               -- deri altı, kas içi, ağızdan, dökme...
    administered_at        timestamptz NOT NULL DEFAULT now(),
    description            text,               -- "Ivomec vuruldu, 4 ml" gibi serbest açıklama
    meat_withdrawal_until  date,               -- tetikleyici doldurur
    milk_withdrawal_until  date,
    batch_id               uuid,               -- tüm sürüye aynı anda yapılan uygulamaları gruplar
    recorded_by            uuid NOT NULL REFERENCES users(id),
    recorded_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (medicine_id IS NOT NULL OR medicine_text IS NOT NULL OR description IS NOT NULL),
    CHECK ((dose IS NULL) = (dose_unit IS NULL))
);
CREATE INDEX treatments_animal_idx ON treatments (animal_id, administered_at DESC);
CREATE INDEX treatments_batch_idx  ON treatments (batch_id) WHERE batch_id IS NOT NULL;
COMMENT ON COLUMN treatments.meat_withdrawal_until IS
    'Kayıt anındaki katalog değerinden hesaplanıp saklanır; katalog sonradan değişse de geçmiş kayıt bozulmaz.';

-- Arınma sürelerini ilaç kataloğundan otomatik hesapla (elle girildiyse dokunma)
CREATE FUNCTION fill_withdrawal_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m medicines%ROWTYPE;
BEGIN
    IF NEW.medicine_id IS NOT NULL THEN
        SELECT * INTO m FROM medicines WHERE id = NEW.medicine_id;
        IF NEW.dose_unit IS NULL AND NEW.dose IS NOT NULL THEN
            NEW.dose_unit := m.default_unit;
        END IF;
        IF NEW.meat_withdrawal_until IS NULL AND m.meat_withdrawal_days IS NOT NULL THEN
            NEW.meat_withdrawal_until := (NEW.administered_at AT TIME ZONE 'Europe/Istanbul')::date + m.meat_withdrawal_days;
        END IF;
        IF NEW.milk_withdrawal_until IS NULL AND m.milk_withdrawal_days IS NOT NULL THEN
            NEW.milk_withdrawal_until := (NEW.administered_at AT TIME ZONE 'Europe/Istanbul')::date + m.milk_withdrawal_days;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER treatments_withdrawal
    BEFORE INSERT ON treatments
    FOR EACH ROW EXECUTE FUNCTION fill_withdrawal_dates();

-- =====================================================================
--  3. TARIM
-- =====================================================================

CREATE TABLE provinces (
    id    smallint PRIMARY KEY,   -- plaka kodu
    name  text NOT NULL UNIQUE
);

CREATE TABLE districts (
    id           serial PRIMARY KEY,
    province_id  smallint NOT NULL REFERENCES provinces(id),
    name         text NOT NULL,
    tkgm_id      int,             -- TKGM'deki ilçe kimliği (entegrasyon için)
    UNIQUE (province_id, name)
);

CREATE TABLE neighborhoods (      -- mahalle / köy (TKGM parsel sorgusu bu seviyede)
    id           serial PRIMARY KEY,
    district_id  int NOT NULL REFERENCES districts(id),
    name         text NOT NULL,
    tkgm_id      int,
    UNIQUE (district_id, name)
);

CREATE TABLE parcels (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id          uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    neighborhood_id  int NOT NULL REFERENCES neighborhoods(id),
    block_no         int NOT NULL,          -- ada
    parcel_no        int NOT NULL,          -- parsel
    locality         text,                  -- mevki
    nickname         text,                  -- "Dere tarla", "Yukarı tarla" gibi
    area_m2          numeric(12,2) CHECK (area_m2 > 0),
    ownership        ownership_type NOT NULL,
    share_numerator    int,                 -- hisseli ise pay (ör. 1/3)
    share_denominator  int,
    title_owner      text,                  -- tapudaki malik adı
    boundary_geojson jsonb,                 -- TKGM'den gelen sınır poligonu
    center_lat       double precision,
    center_lon       double precision,
    notes            text,
    created_by       uuid NOT NULL REFERENCES users(id),
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (farm_id, neighborhood_id, block_no, parcel_no),
    CHECK ((share_numerator IS NULL) = (share_denominator IS NULL)),
    CHECK (share_numerator IS NULL OR (share_numerator > 0 AND share_numerator <= share_denominator))
);
COMMENT ON COLUMN parcels.center_lat IS 'Hava durumu sorgusu ve harita/uydu görüntüsü bu koordinatla yapılır.';

-- Kira / ortakçılık sözleşmeleri
CREATE TABLE parcel_leases (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id      uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    counterparty   text NOT NULL,        -- kiraya veren / ortak
    start_date     date NOT NULL,
    end_date       date,
    terms          text,                 -- nakit, ürün payı vb.
    amount         numeric(12,2),
    currency       char(3) DEFAULT 'TRY',
    document_url   text,                 -- sözleşme taraması
    notes          text,
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE crops (
    id    serial PRIMARY KEY,
    name  text NOT NULL UNIQUE      -- buğday, arpa, ayçiçeği, nohut, yonca...
);

-- Yıllara göre ekilen ürün ve verim
CREATE TABLE crop_seasons (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id      uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    season_year    smallint NOT NULL CHECK (season_year BETWEEN 1950 AND 2200),
    crop_id        int REFERENCES crops(id),   -- NULL = nadas
    variety        text,                       -- tohum çeşidi
    planted_area_m2 numeric(12,2),
    sowing_date    date,
    harvest_date   date,
    yield_kg       numeric(12,2) CHECK (yield_kg >= 0),
    notes          text,
    UNIQUE (parcel_id, season_year, crop_id)
);

-- Tarlaya yapılan işlemler ve tarihleri
CREATE TABLE field_operations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id     uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    season_id     uuid REFERENCES crop_seasons(id) ON DELETE SET NULL,
    type          operation_type NOT NULL,
    performed_on  date NOT NULL,
    product       text,               -- kullanılan gübre / ilaç / tohum
    quantity      numeric(12,3),
    unit          text,
    cost          numeric(12,2),
    description   text,
    recorded_by   uuid NOT NULL REFERENCES users(id),
    recorded_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX field_ops_parcel_idx ON field_operations (parcel_id, performed_on DESC);

-- =====================================================================
--  4. BİLDİRİM VE YAPAY ZEKÂ
-- =====================================================================

CREATE TABLE notifications (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id      uuid REFERENCES farms(id) ON DELETE CASCADE,
    kind         text NOT NULL,       -- weather_rain, weather_wind, withdrawal_end, vaccine_due...
    title        text NOT NULL,
    body         text,
    parcel_id    uuid REFERENCES parcels(id) ON DELETE CASCADE,
    animal_id    uuid REFERENCES animals(id) ON DELETE CASCADE,
    dedupe_key   text,                -- aynı uyarının tekrar gönderilmemesi için
    created_at   timestamptz NOT NULL DEFAULT now(),
    read_at      timestamptz,
    UNIQUE (user_id, dedupe_key)
);
CREATE INDEX notifications_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE ai_conversations (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id      uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    animal_id    uuid REFERENCES animals(id) ON DELETE SET NULL,   -- sohbet bir hayvan profilinden açıldıysa
    parcel_id    uuid REFERENCES parcels(id) ON DELETE SET NULL,   -- veya bir tarladan
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
    id               bigserial PRIMARY KEY,
    conversation_id  uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role             ai_role NOT NULL,
    content          text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conv_idx ON ai_messages (conversation_id, id);

-- =====================================================================
--  5. GÖRÜNÜMLER (VIEW)
-- =====================================================================

-- Hayvan listesi: yaş ve güncel konum hesaplanmış
CREATE VIEW v_animals AS
SELECT a.*,
       s.name AS species_name,
       b.name AS breed_name,
       CASE WHEN a.birth_date IS NULL THEN NULL
            ELSE (EXTRACT(YEAR FROM age(COALESCE(a.exited_on, current_date), a.birth_date)) * 12
                + EXTRACT(MONTH FROM age(COALESCE(a.exited_on, current_date), a.birth_date)))::int
       END AS age_months,
       loc.location AS current_location,
       loc.since    AS location_since,
       w.weight_kg  AS last_weight_kg,
       w.weighed_on AS last_weighed_on
FROM animals a
JOIN species s ON s.id = a.species_id
LEFT JOIN breeds b ON b.id = a.breed_id
LEFT JOIN LATERAL (
    SELECT e.location, e.since
    FROM animal_location_events e
    WHERE e.animal_id = a.id
    ORDER BY e.since DESC
    LIMIT 1
) loc ON true
LEFT JOIN LATERAL (
    SELECT aw.weight_kg, aw.weighed_on
    FROM animal_weights aw
    WHERE aw.animal_id = a.id
    ORDER BY aw.weighed_on DESC, aw.id DESC
    LIMIT 1
) w ON true;

-- Hayvan profilindeki sağlık zaman çizelgesi (hastalık + tedavi tek akışta)
CREATE VIEW v_health_timeline AS
SELECT t.animal_id,
       t.administered_at                         AS event_at,
       'treatment'::text                         AS event_kind,
       t.type::text                              AS subtype,
       COALESCE(m.name, t.medicine_text)         AS title,
       CASE WHEN t.dose IS NOT NULL THEN trim_scale(t.dose)::text || ' ' || t.dose_unit END AS dose,
       t.description,
       u.full_name                               AS recorded_by_name
FROM treatments t
LEFT JOIN medicines m ON m.id = t.medicine_id
JOIN users u ON u.id = t.recorded_by
UNION ALL
SELECT i.animal_id,
       i.started_on::timestamptz,
       'illness',
       CASE WHEN i.resolved_on IS NULL THEN 'ongoing' ELSE 'resolved' END,
       i.diagnosis,
       NULL,
       i.notes,
       u.full_name
FROM illnesses i
JOIN users u ON u.id = i.recorded_by;

-- Arınma süresi devam eden hayvanlar (kesim/süt satışı yasak uyarısı)
CREATE VIEW v_active_withdrawals AS
SELECT a.farm_id, a.id AS animal_id, a.ear_tag, a.name,
       MAX(t.meat_withdrawal_until) FILTER (WHERE t.meat_withdrawal_until >= current_date) AS meat_blocked_until,
       MAX(t.milk_withdrawal_until) FILTER (WHERE t.milk_withdrawal_until >= current_date) AS milk_blocked_until
FROM animals a
JOIN treatments t ON t.animal_id = a.id
WHERE a.status = 'active'
GROUP BY a.farm_id, a.id, a.ear_tag, a.name
HAVING MAX(t.meat_withdrawal_until) >= current_date
    OR MAX(t.milk_withdrawal_until) >= current_date;

-- Tarla verim geçmişi (dekar başına)
CREATE VIEW v_parcel_yields AS
SELECT p.farm_id, p.id AS parcel_id, p.nickname, p.block_no, p.parcel_no,
       cs.season_year, c.name AS crop_name, cs.yield_kg,
       ROUND(cs.yield_kg / NULLIF(COALESCE(cs.planted_area_m2, p.area_m2) / 1000.0, 0), 1) AS yield_kg_per_decare
FROM crop_seasons cs
JOIN parcels p ON p.id = cs.parcel_id
LEFT JOIN crops c ON c.id = cs.crop_id;

-- =====================================================================
--  6. YETKİ FONKSİYONU
--  Kullanıcı bu hayvanı görebilir / kayıt ekleyebilir mi?
--  owner/manager: işletmedeki tüm hayvanlar
--  shepherd: yalnızca atandığı sürülerdeki hayvanlar
--  viewer: görür, kayıt ekleyemez (uygulama katmanında kontrol edilir)
--  Hayvan ekleme/silme/düzenleme yalnızca owner ve manager içindir; çoban
--  sadece olay kaydı (tedavi, hastalık, konum, yavrulama, tartım) ekler.
-- =====================================================================
CREATE FUNCTION can_access_animal(p_user uuid, p_animal uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1
        FROM animals a
        JOIN farm_members fm ON fm.farm_id = a.farm_id AND fm.user_id = p_user
        WHERE a.id = p_animal
          AND (
                fm.role IN ('owner', 'manager', 'viewer')
             OR (fm.role = 'shepherd' AND EXISTS (
                    SELECT 1 FROM herd_assignments ha
                    WHERE ha.herd_id = a.herd_id AND ha.user_id = p_user))
          )
    );
$$;

-- Hayvan ekleme / silme / kimlik bilgisi düzenleme yetkisi (çoban hariç)
CREATE FUNCTION can_manage_animals(p_user uuid, p_farm uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM farm_members
        WHERE farm_id = p_farm AND user_id = p_user
          AND role IN ('owner', 'manager')
    );
$$;

-- =====================================================================
--  7. BAŞLANGIÇ VERİLERİ
-- =====================================================================
INSERT INTO species (id, code, name) VALUES
    (1, 'dog',    'Köpek'),
    (2, 'donkey', 'Eşek'),
    (3, 'cattle', 'İnek / Sığır'),
    (4, 'goat',   'Keçi'),
    (5, 'sheep',  'Koyun');

-- Arınma süreleri bilerek boş bırakıldı: prospektüsten girilmeli.
INSERT INTO medicines (name, active_ingredient, default_unit) VALUES
    ('Ivomec', 'ivermektin', 'ml');
