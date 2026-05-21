// Per-hole distances (feet) and pars for all supported courses
// Palmer/Kensington: distances estimated from terrain data (actual GPS-derived)
// Thorn, Grizzly, Cass Benton: UDisc Short Tees layout — sourced 2025

// Per-hole tee and basket GPS coordinates [lat, lng]
// Grizzly Oaks: extracted from UDisc course-map page source 2025-05-21
// Thorn, Cass Benton: pending
export const COURSE_HOLE_COORDS = {
  grizzly: [
    // hole 1
    { tee: [42.676408487217714, -83.20907032841383], basket: [42.67602826339177, -83.20750934380766] },
    // hole 2
    { tee: [42.676163578496585, -83.20694860889868], basket: [42.67671043771054, -83.20795051093717] },
    // hole 3
    { tee: [42.677573525922384, -83.2074774198621],  basket: [42.67735563428138, -83.20639704426753] },
    // hole 4
    { tee: [42.67732878881645,  -83.20581687471145], basket: [42.67779364960747, -83.20517041803959] },
    // hole 5
    { tee: [42.678032231563705, -83.20535322998084], basket: [42.67843430819246, -83.20587332745168] },
    // hole 6
    { tee: [42.6784868,         -83.2060211],        basket: [42.677584583952,   -83.206353789785]   },
    // hole 7
    { tee: [42.67790033124013,  -83.2064473234815],  basket: [42.67857454035,    -83.206594780478]   },
    // hole 8
    { tee: [42.678337997239296, -83.20660759651406], basket: [42.67895886894,    -83.206647193468]   },
    // hole 9
    { tee: [42.67906296739261,  -83.20653376411096], basket: [42.679317681299,   -83.20544869255]    },
    // hole 10
    { tee: [42.679232391129744, -83.2053352336192],  basket: [42.6787515795114,  -83.20650426728156] },
    // hole 11
    { tee: [42.678599916305,    -83.206352012824],   basket: [42.679085669171,   -83.205183503313]   },
    // hole 12
    { tee: [42.678731568147,    -83.20502417791],    basket: [42.678130679482415,-83.2048274368889]  },
    // hole 13
    { tee: [42.677910633239,    -83.204721135289],   basket: [42.678731766744,   -83.205776479001]   },
    // hole 14
    { tee: [42.67843237492041,  -83.20562600947444], basket: [42.6779754874096,  -83.20500795240636] },
    // hole 15
    { tee: [42.677837477279,    -83.204719649272],   basket: [42.677086263622,   -83.205484404682]   },
    // hole 16
    { tee: [42.67706479383568,  -83.20538334825221], basket: [42.67652041522396, -83.20486608655686] },
    // hole 17
    { tee: [42.676396640238,    -83.204564064082],   basket: [42.676507252836,   -83.206043869259]   },
    // hole 18
    { tee: [42.67676737017508,  -83.205908551139],   basket: [42.67715585593605, -83.20772307648521] },
  ],
  thorn: null,       // TODO: extract from UDisc
  cass_benton: null, // TODO: extract from UDisc
}

export const COURSE_HOLES = {
  palmer: {
    distances: [240, 295, 310, 265, 330, 285, 275, 315, 255, 280, 305, 265, 325, 290, 270, 345, 280, 315],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  },
  kensington: {
    distances: [280, 410, 270, 315, 455, 285, 265, 305, 425, 270, 315, 285, 265, 435, 295, 325, 275, 300],
    pars: [3, 4, 3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
  },
  thorn: {
    // The Short Thorne layout — Pontiac Oaks County Park, Pontiac MI
    // UDisc: udisc.com/courses/the-thorne-at-pontiac-oaks-5IHy
    distances: [300, 275, 300, 269, 275, 225, 275, 500, 287, 310, 450, 250, 357, 275, 225, 275, 609, 350],
    pars: [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 4, 3, 3, 3, 3, 3, 4, 3],
  },
  grizzly: {
    // Grizzly Oaks at Oakland University, Rochester Hills MI (concrete tee pads installed 2023)
    // UDisc: udisc.com/courses/grizzly-oaks-r09O — Hole 18 is par 4 (522 ft), all others par 3
    distances: [376, 318, 297, 276, 221, 359, 258, 278, 302, 371, 328, 216, 341, 216, 315, 208, 276, 522],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4],
  },
  cass_benton: {
    // Cass Benton Hills, Northville MI (est. 1999) — Short Tees layout
    // UDisc: udisc.com/courses/cass-benton-hills-9hkZ — Hole 18 is par 4 (527 ft), all others par 3
    distances: [207, 278, 441, 219, 230, 263, 182, 372, 231, 196, 169, 267, 270, 196, 201, 232, 236, 527],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4],
  },
}

// Returns distance in feet for a given course + 1-indexed hole number
export function getHoleDistance(courseKey, holeNumber) {
  return COURSE_HOLES[courseKey]?.distances[holeNumber - 1] ?? null
}

// Returns par for a given course + 1-indexed hole number
export function getHolePar(courseKey, holeNumber) {
  return COURSE_HOLES[courseKey]?.pars[holeNumber - 1] ?? 3
}

// Returns total par for a course
export function getCoursePar(courseKey) {
  return (COURSE_HOLES[courseKey]?.pars || []).reduce((s, p) => s + p, 0)
}
