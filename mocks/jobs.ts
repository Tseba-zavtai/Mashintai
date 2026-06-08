// mocks/jobs.ts
export type JobCategory = string;
export type PostType = "job" | "worker";

export interface JobImageLocation {
  latitude: number | null;
  longitude: number | null;
  address?: string | null;
}

export interface JobPostedBy {
  id?: string | null;
  name: string;
  phone: string;
  rating?: number;
  jobsCompleted?: number;
  photoUri?: string | null;
}

export interface Job {
  id: string;
  title: string;
  description: string;

  // category
  category: string | null;
  category_id?: string | null;
  subcategory?: string | null;
  subcategory_id?: string | null;

  // type
  postType: PostType;

  // owner
  postedBy: JobPostedBy;

  // meta
  postedDate: Date;
  applicants: number;

  // optional location
  location?: JobImageLocation | null;

  // image support
  image_url?: string | null;
  image_urls?: string[];

  // flags
  isSponsored?: boolean;
  sponsoredUntil?: Date | null;
  isActive?: boolean;

  // optional business fields
  salary?: string | number | null;
  urgency?: string | null;

  // allow legacy / db-mapped extra fields without compile break
  [key: string]: any;
}

// fallback category list
// DB холбогдоогүй үед admin / local UI дээр ашиглаж болно
export const JOB_CATEGORIES: string[] = [
  "Тээврийн хэрэгсэл",
  "Барилга, засварын тоног төхөөрөмж",
  "Арга хэмжээ, event-ийн хэрэгсэл",
  "Ахуйн болон өдөр тутмын хэрэглээ",
  "Аялал, outdoor хэрэгсэл",
  "Фото, видео, контентын тоног төхөөрөмж",
  "Тоглоом, entertainment",
  "Оффис, бизнесийн хэрэглээ",
  "Хүнд машин механизм, тусгай хэрэгсэл",
  "Хувцас, тусгай хэрэглээ",
  "Спорт, хобби",
  "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл",
];

export const JOB_SUBCATEGORIES: Record<string, string[]> = {
  "Тээврийн хэрэгсэл": [
    "Суудлын машин",
    "SUV",
    "Pickup",
    "Ачааны машин",
    "Микро",
    "Мотоцикл",
    "Скүүтер",
    "Унадаг дугуй",
    "Цахилгаан дугуй",
    "Caravan / trailer",
  ],

  "Барилга, засварын тоног төхөөрөмж": [
    "Өрөм",
    "Дрилл",
    "Бетон зүсэгч",
    "Цахилгаан хөрөө",
    "Гагнуурын аппарат",
    "Шат",
    "Лазер тэгш ус",
    "Компрессор",
    "Генератор",
    "Усны насос",
  ],

  "Арга хэмжээ, event-ийн хэрэгсэл": [
    "Майхан",
    "Ширээ сандал",
    "Тайзны тоноглол",
    "Speaker",
    "Microphone",
    "Karaoke set",
    "Projector",
    "LED screen",
    "Photo booth",
    "Гэрэлтүүлэг",
  ],

  "Ахуйн болон өдөр тутмын хэрэглээ": [
    "Хүүхдийн тэрэг",
    "Хүүхдийн машины суудал",
    "Нялх хүүхдийн ор",
    "Wheelchair",
    "Өвчтөний ор",
    "Зөөврийн халаагуур",
    "Air purifier",
    "Vacuum cleaner",
    "Carpet cleaner",
  ],

  "Аялал, outdoor хэрэгсэл": [
    "Кемпийн майхан",
    "Унтлагын уут",
    "Кемпийн ширээ сандал",
    "Хийн плитка",
    "Cool box",
    "Загасчлалын хэрэгсэл",
    "Уулын дугуй",
    "GPS төхөөрөмж",
    "Walkie talkie/станц",
    "Portable battery/power bank",
  ],

  "Фото, видео, контентын тоног төхөөрөмж": [
    "Camera",
    "Lens",
    "Gimbal",
    "Tripod",
    "Drone",
    "Action camera",
    "Lighting kit",
    "Microphone",
    "Teleprompter",
    "Backdrop stand",
  ],

  "Тоглоом, entertainment": [
    "Projector + screen set",
    "Karaoke set",
    "VR headset",
    "Board games багц",
    "Air hockey / party game set",
    "Sim racing setup",
    "PS, Nintendo, Sega, etc",
  ],

  "Оффис, бизнесийн хэрэглээ": [
    "Зөөврийн компьютер",
    "Printer",
    "Scanner",
    "POS төхөөрөмж",
    "Barcode scanner",
    "Label printer",
    "Meeting speakerphone",
    "Tablet",
    "Wi-Fi router",
    "Зөөврийн дэлгэц",
  ],

  "Хүнд машин механизм, тусгай хэрэгсэл": [
    "Сэрээт ачигч",
    "Кран",
    "Ковш",
    "Индүү",
    "Excavator төрлийн техник",
    "Pallet jack",
    "Hand stacker",
  ],

  "Хувцас, тусгай хэрэглээ": [
    "Гоёлын даашинз",
    "Үндэсний хувцас",
    "Костюм",
    "Тайзны хувцас",
    "Mascot хувцас",
    "Хамгаалалтын хувцас",
  ],

  "Спорт, хобби": [
    "Цанын хэрэгсэл",
    "Snowboard",
    "Тэшүүр",
    "Фитнес тоног төхөөрөмж",
    "Paddle board",
    "Kayak",
    "Tennis racket",
    "Boxing gear",
  ],

  "Мал аж ахуй, хөдөө аж ахуйн хэрэгсэл": [
    "Өвс хадах машин",
    "Газар сэндийлэгч",
    "Мотоблок",
    "Шүршигч аппарат",
    "Усалгааны насос",
    "Цахилгаан хашааны төхөөрөмж",
  ],
};

// Production дээр demo / test зар хэрэггүй
export const MOCK_JOBS: Job[] = [];