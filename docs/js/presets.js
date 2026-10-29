// Published lists of recommended random wire lengths, in feet as published.

export const PRESETS = {
    VE3EED: {
        // reprinted in: SARC Communicator 2018-11 https://archive.org/details/SARC_Communicator_2018-11/
        name: 'Jack VE3EED',
        feet: '29 35.5 41 58 71 84 107 119 148 203 347 407 423',
        url: 'https://www.hamuniverse.com/randomwireantennalengths.html',
    },
    balundesigns1: {
        // https://www.balundesigns.com/content/Wire%20Lengths%20for%204%20and%209-1%20ununs.pdf [date?] found via https://youtu.be/xfqlun3bdI0?t=86 [2017]
        name: 'Balun Designs, 160m to 10m',
        feet: '53 59 72 88.5 98.5 124.5 146 162 175',
    },
    balundesigns2: {
        name: 'Balun Designs, 40m to 6m',
        feet: '36 44 49',
    },
    balundesigns3: {
        name: 'Balun Designs, 160m to 10m alternatives',
        feet: '58 71 84 107 119 148 203',
    },
    qrpguys4010: {
        name: 'QRPGuys 40m-10m UnUnTenna (9:1)',
        feet: '29 35.5 41',
    },
    sparc: {
        // https://sparc.asn.au/2022/04/22/random-wire-eflw-antenna-designs/ Author: Steven VK3TR
        // TODO: add #2 ranks too; double check numbers
        name: 'VK3TR / SPARC VK3BSP blog (#0 and #1)',
        feet: '41 43 62 64 112 125 126 166 167 202 223 225 226 251 261 310 318 320 400 402 423',
        url: 'https://sparc.asn.au/2022/04/22/random-wire-eflw-antenna-designs/',
    },
    sprott: {
        // Gaps in the quarter-wavelength spectrum 0-30 MHz. "The shortest antenna that has a
        // chance of tuning all bands has an electrical length of 143 [feet]"
        name: 'J. C. Sprott',
        feet: '19 21 25 30 37 42 48 49 53 57 63 74 80 82 90 95 98 99 107 112 143 148 159 165 176 180 194 196 198 213 229 281',
        url: 'https://sprott.physics.wisc.edu/technote/randwire.htm',
    },
    // Not yet added:
    // - aliexpress special includes 16.5m antenna, 10m ground
    // - blog: "I measured out 21.6 m of wire (which for ✨magic✨ reasons seem to be a good universal antenna length)…" // https://blinry.org/50-things-with-sdr/
    // - " A standard recommendation for the 40m band (see QST, March 1936, p. 32, "An Unorthodox Antenna") is an 84' long end fed and a 17' long counterpoise (6.5' for 20m)." -- https://udel.edu/~mm/ham/randomWire/
    // - "The best counterpoise is 1/4-wavelength at the lowest frequency you intend to use." -- https://www.arrl.org/random-wires
};

export function presetLengthsFeet(key) {
    const p = PRESETS[key];
    return p ? p.feet.split(/\s+/).filter(Boolean).map(Number) : [];
}
