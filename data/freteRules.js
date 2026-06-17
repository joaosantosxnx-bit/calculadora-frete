const regrasFrete = {
  ES: [
    { transportadora: "SAGIX", tipo: "sagix" },
    { transportadora: "TJB", tipo: "base", rkg: 7.0758, percentualNota: 0.5868, minimo: 0 },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 1.9336, percentualNota: 0.1547, minimo: 0 }
  ],

  SP_CAPITAL: [
    { transportadora: "SAGIX", tipo: "sagix" },
    { transportadora: "TJB", tipo: "base", rkg: 66.0714, percentualNota: 0.1571, minimo: 0 },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 15.2341, percentualNota: 0.1547, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 1.0095, percentualNota: 0.0417, minimo: 0 }
  ],

  SP_INTERIOR: [
    { transportadora: "SAGIX", tipo: "sagix" },
    { transportadora: "TJB", tipo: "base", rkg: 66.0714, percentualNota: 0.1571, minimo: 0 },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 15.2341, percentualNota: 0.1547, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 1.0095, percentualNota: 0.0417, minimo: 0 }
  ],

  MG: [
    { transportadora: "TG TRANSPORTES", tipo: "base", rkg: 6.6537, percentualNota: 0.1833, minimo: 0 },
    { transportadora: "RVR LOG", tipo: "base", rkg: 1.1263, percentualNota: 0.0221, minimo: 0 }
  ],

  RJ: [
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 2.1725, percentualNota: 0.0856, minimo: 0 }
  ],

  BA: [
    { transportadora: "SNT LOG", tipo: "base", rkg: 2.2899, percentualNota: 0.0946, minimo: 0 },
    { transportadora: "CONEXAO LOG", tipo: "base", rkg: 2.6042, percentualNota: 0.0954, minimo: 0 }
  ],

  PR: [
    { transportadora: "TJB", tipo: "base", rkg: 4.1052, percentualNota: 0.0988, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 2.5510, percentualNota: 0.0988, minimo: 0 }
  ],

  SC: [
    { transportadora: "TJB", tipo: "base", rkg: 1.8536, percentualNota: 0.0888, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 4.0120, percentualNota: 0.0861, minimo: 0 }
  ],

  AL: [
    { transportadora: "SNT LOG", tipo: "base", rkg: 1.8618, percentualNota: 0.2886, minimo: 0 }
  ]
};

module.exports = regrasFrete;