const CITY_CODES: Record<string, string> = {
  shanghai: "021",
  beijing: "010",
  xian: "029",
  chengdu: "028",
  guangzhou: "020",
  shenzhen: "0755",
  hangzhou: "0571",
  suzhou: "0512",
  nanjing: "025",
  chongqing: "023",
  guilin: "0773",
};

export const getAmapCityCode = (cityId: string): string | undefined => CITY_CODES[cityId];
