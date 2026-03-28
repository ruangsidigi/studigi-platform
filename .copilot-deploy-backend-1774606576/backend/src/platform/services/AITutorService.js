class AITutorService {
  async generateHint({ topic, skillScore }) {
    if (Number(skillScore || 0) < 55) {
      return `Mulai dari konsep dasar ${topic}. Fokus pada 5 soal pertama, lalu cek kesalahan satu per satu.`;
    }

    if (Number(skillScore || 0) < 75) {
      return `Latih ${topic} dengan soal menengah dan catat pola salah yang berulang.`;
    }

    return `Kamu sudah kuat di ${topic}. Coba soal sulit dengan batas waktu lebih ketat.`;
  }
}

module.exports = new AITutorService();
