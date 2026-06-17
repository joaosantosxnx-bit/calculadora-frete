const regrasFrete = {
  SP_INTERIOR: [
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
  ]
};

module.exports = regrasFrete;
