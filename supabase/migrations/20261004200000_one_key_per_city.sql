-- One key per city (worldwide discovery W0, docs/engine/worldwide-plan.md).
-- Geocoder spellings split cities: Tirana was "tirane" (12) + "tirana" (2), Munich
-- "munchen"/"mynihu", Vienna "wien"/"vienna", London "city-of-westminster", ...
-- The app keys cities in English (lib/locations.ts, HomeClient BIG_CITY_BY_COUNTRY),
-- so every spelling moves to the canonical key from engine/core/places.ts.
-- Generated from the live slugs on 2026-10-04 and dry-run with ROLLBACK first.
-- Idempotent: re-running changes nothing. New writes already use lib/citySlug.ts.

-- 1) One key per city on events, places and submissions.
update public.event_submissions set location_slug = 'bremen' where location_slug in ('stadtgebiet-bremen');
update public.event_submissions set location_slug = 'brussels' where location_slug in ('bruxelles-brussel');
update public.event_submissions set location_slug = 'cologne' where location_slug in ('koln');
update public.event_submissions set location_slug = 'durres' where location_slug in ('bashkia-durres');
update public.event_submissions set location_slug = 'frankfurt' where location_slug in ('frankfurt-am-main');
update public.event_submissions set location_slug = 'geneva' where location_slug in ('geneve');
update public.event_submissions set location_slug = 'genoa' where location_slug in ('genova');
update public.event_submissions set location_slug = 'london' where location_slug in ('city-of-westminster');
update public.event_submissions set location_slug = 'milan' where location_slug in ('milano');
update public.event_submissions set location_slug = 'munich' where location_slug in ('munchen');
update public.event_submissions set location_slug = 'nuremberg' where location_slug in ('nurnberg');
update public.event_submissions set location_slug = 'rome' where location_slug in ('roma');
update public.event_submissions set location_slug = 'tirana' where location_slug in ('tirane');
update public.event_submissions set location_slug = 'turin' where location_slug in ('torino');
update public.event_submissions set location_slug = 'vienna' where location_slug in ('wien');
update public.event_submissions set location_slug = 'vlore' where location_slug in ('qender-vlore');
update public.events set location_slug = 'athens' where location_slug in ('Athen');
update public.events set location_slug = 'bremen' where location_slug in ('stadtgebiet-bremen');
update public.events set location_slug = 'brussels' where location_slug in ('bruxelles-brussel');
update public.events set location_slug = 'cologne' where location_slug in ('koln');
update public.events set location_slug = 'durres' where location_slug in ('bashkia-durres');
update public.events set location_slug = 'frankfurt' where location_slug in ('frankfurt-am-main', 'frankfurti-mbi-main');
update public.events set location_slug = 'geneva' where location_slug in ('geneve');
update public.events set location_slug = 'genoa' where location_slug in ('genova');
update public.events set location_slug = 'london' where location_slug in ('city-of-westminster');
update public.events set location_slug = 'milan' where location_slug in ('milano');
update public.events set location_slug = 'munich' where location_slug in ('munchen');
update public.events set location_slug = 'nuremberg' where location_slug in ('nurnberg');
update public.events set location_slug = 'rome' where location_slug in ('roma');
update public.events set location_slug = 'tirana' where location_slug in ('tirane');
update public.events set location_slug = 'turin' where location_slug in ('torino');
update public.events set location_slug = 'vienna' where location_slug in ('wien');
update public.events set location_slug = 'vlore' where location_slug in ('qender-vlore');

-- 2) The city list: rename to the canonical key, or drop the duplicate when the canonical row exists.
delete from public.cities where slug = 'bashkia-durres'; -- duplicate of durres
update public.cities set slug = 'kruje', name = 'Krujë' where slug = 'bashkia-kruje';
update public.cities set slug = 'brussels', name = 'Brussels' where slug = 'bruxelles-brussel';
update public.cities set slug = 'london', name = 'London' where slug = 'city-of-westminster';
update public.cities set slug = 'frankfurt', name = 'Frankfurt' where slug = 'frankfurt-am-main';
delete from public.cities where slug = 'frankfurti-mbi-main'; -- duplicate of frankfurt
update public.cities set slug = 'geneva', name = 'Geneva' where slug = 'geneve';
update public.cities set slug = 'genoa', name = 'Genoa' where slug = 'genova';
update public.cities set slug = 'cologne', name = 'Cologne' where slug = 'koln';
update public.cities set slug = 'milan', name = 'Milan' where slug = 'milano';
update public.cities set slug = 'munich', name = 'Munich' where slug = 'munchen';
delete from public.cities where slug = 'mynihu'; -- duplicate of munich
update public.cities set slug = 'nuremberg', name = 'Nuremberg' where slug = 'nurnberg';
delete from public.cities where slug = 'qender-vlore'; -- duplicate of vlore
update public.cities set slug = 'rome', name = 'Rome' where slug = 'roma';
delete from public.cities where slug = 'stadtgebiet-bremen'; -- duplicate of bremen
delete from public.cities where slug = 'tirane'; -- duplicate of tirana
update public.cities set slug = 'turin', name = 'Turin' where slug = 'torino';
delete from public.cities where slug = 'wien'; -- duplicate of vienna

-- 3) Display names for canonical rows that kept their key.
update public.cities set name = 'Amsterdam' where slug = 'amsterdam' and name <> 'Amsterdam';
update public.cities set name = 'Bari' where slug = 'bari' and name <> 'Bari';
update public.cities set name = 'Basel' where slug = 'basel' and name <> 'Basel';
update public.cities set name = 'Berlin' where slug = 'berlin' and name <> 'Berlin';
update public.cities set name = 'Birmingham' where slug = 'birmingham' and name <> 'Birmingham';
update public.cities set name = 'Boston' where slug = 'boston' and name <> 'Boston';
update public.cities set name = 'Bremen' where slug = 'bremen' and name <> 'Bremen';
update public.cities set name = 'Chicago' where slug = 'chicago' and name <> 'Chicago';
update public.cities set name = 'Dortmund' where slug = 'dortmund' and name <> 'Dortmund';
update public.cities set name = 'Durrës' where slug = 'durres' and name <> 'Durrës';
update public.cities set name = 'Düsseldorf' where slug = 'dusseldorf' and name <> 'Düsseldorf';
update public.cities set name = 'Fier' where slug = 'fier' and name <> 'Fier';
update public.cities set name = 'Gjirokastër' where slug = 'gjirokaster' and name <> 'Gjirokastër';
update public.cities set name = 'Graz' where slug = 'graz' and name <> 'Graz';
update public.cities set name = 'Hamburg' where slug = 'hamburg' and name <> 'Hamburg';
update public.cities set name = 'Himarë' where slug = 'himare' and name <> 'Himarë';
update public.cities set name = 'Kavajë' where slug = 'kavaje' and name <> 'Kavajë';
update public.cities set name = 'Korçë' where slug = 'korce' and name <> 'Korçë';
update public.cities set name = 'Ksamil' where slug = 'ksamil' and name <> 'Ksamil';
update public.cities set name = 'Linz' where slug = 'linz' and name <> 'Linz';
update public.cities set name = 'Luxembourg' where slug = 'luxembourg' and name <> 'Luxembourg';
update public.cities set name = 'Malmö' where slug = 'malmo' and name <> 'Malmö';
update public.cities set name = 'New York' where slug = 'new-york' and name <> 'New York';
update public.cities set name = 'Oslo' where slug = 'oslo' and name <> 'Oslo';
update public.cities set name = 'Paris' where slug = 'paris' and name <> 'Paris';
update public.cities set name = 'Philadelphia' where slug = 'philadelphia' and name <> 'Philadelphia';
update public.cities set name = 'Pogradec' where slug = 'pogradec' and name <> 'Pogradec';
update public.cities set name = 'Prishtina' where slug = 'prishtina' and name <> 'Prishtina';
update public.cities set name = 'Sarandë' where slug = 'sarande' and name <> 'Sarandë';
update public.cities set name = 'Shkodër' where slug = 'shkoder' and name <> 'Shkodër';
update public.cities set name = 'Stockholm' where slug = 'stockholm' and name <> 'Stockholm';
update public.cities set name = 'Stuttgart' where slug = 'stuttgart' and name <> 'Stuttgart';
update public.cities set name = 'Tirana' where slug = 'tirana' and name <> 'Tirana';
update public.cities set name = 'Toronto' where slug = 'toronto' and name <> 'Toronto';
update public.cities set name = 'Velipojë' where slug = 'velipoje' and name <> 'Velipojë';
update public.cities set name = 'Vienna' where slug = 'vienna' and name <> 'Vienna';
update public.cities set name = 'Vlorë' where slug = 'vlore' and name <> 'Vlorë';
update public.cities set name = 'Zurich' where slug = 'zurich' and name <> 'Zurich';

