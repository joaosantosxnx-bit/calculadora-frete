const regrasFrete = {
  ES: [
    { transportadora: "SAGIX", tipo: "sagix" },
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 1.9336, percentualNota: 0.1547, minimo: 0 }
  ],

  SP_CAPITAL: [
    { transportadora: "SAGIX", tipo: "sagix" },
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 15.2341, percentualNota: 0.1547, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 1.0095, percentualNota: 0.0417, minimo: 0 }
  ],

  SP_INTERIOR: [
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "KR TRANSPORTES", tipo: "base", rkg: 15.2341, percentualNota: 0.1547, minimo: 0 },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 1.0095, percentualNota: 0.0417, minimo: 0 }
  ],

  MG: [
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "TG TRANSPORTES", tipo: "base", rkg: 6.6537, percentualNota: 0.1833, minimo: 0 },
    { transportadora: "RVR LOG", tipo: "base", rkg: 1.1263, percentualNota: 0.0221, minimo: 0 }
  ],

  RJ: [
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "TODOBRASIL", tipo: "base", rkg: 2.1725, percentualNota: 0.0856, minimo: 0 }
  ],

  BA: [
    { transportadora: "TJB", tipo: "tjb" },
    { transportadora: "SNT LOG", tipo: "base", rkg: 2.2899, percentualNota: 0.0946, minimo: 0 },
    { transportadora: "CONEXAO LOG", tipo: "base", rkg: 2.6042, percentualNota: 0.0954, minimo: 0 }
  ]
};

module.exports = regrasFrete;
