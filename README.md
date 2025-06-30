<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Samuel | Full Stack Developer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      padding: 2rem;
      background: #f9f9f9;
      color: #333;
    }

    .lang-switcher {
      margin-bottom: 1rem;
    }

    button {
      padding: 0.5rem 1rem;
      margin-right: 1rem;
      cursor: pointer;
      border: none;
      background: #0077b5;
      color: white;
      border-radius: 5px;
    }

    section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 0 8px rgba(0, 0, 0, 0.1);
    }
  </style>
</head>
<body>

  <div class="lang-switcher">
    <button onclick="changeLanguage('en')">English</button>
    <button onclick="changeLanguage('pt')">Português (Brasil)</button>
  </div>

  <section id="profile">
    <!-- Content will be injected here -->
  </section>

  <script>
    const profileContent = {
      en: `
        <h1>👋 Hi, I'm Samuel</h1>
        <h2>💼 Full Stack Developer | Passionate About Web Technologies and Scalable Solutions</h2>
        <p>
          Professional with 1.5 years of experience at <strong>E-Tech</strong>, working on maintaining and evolving legacy systems using <strong>Framework7</strong> and <strong>PHP</strong>. 
          Also engaged in modern projects using <strong>Next.js</strong>, <strong>React.js</strong>, and <strong>Angular</strong>, with hands-on knowledge in <strong>Python</strong>, <strong>AWS</strong>, and <strong>Java</strong>.
        </p>
        <p>
          Skilled in relational and non-relational databases such as <strong>PostgreSQL</strong>, <strong>MySQL</strong>, and <strong>MongoDB</strong>.
          Certified in <strong>Power BI</strong>, <strong>Kubernetes</strong>, and <strong>Docker</strong> (basic level), showing adaptability across development, analytics, and infrastructure.
        </p>
        <p>
          A flexible and committed professional focused on delivering robust, efficient, and scalable solutions.
        </p>
      `,
      pt: `
        <h1>👋 Olá, eu sou o Samuel</h1>
        <h2>💼 Desenvolvedor Full Stack | Apaixonado por Tecnologias Web e Soluções Escaláveis</h2>
        <p>
          Profissional com 1,5 anos de experiência na <strong>E-Tech</strong>, atuando na manutenção e evolução de sistemas legados utilizando <strong>Framework7</strong> e <strong>PHP</strong>.
          Também envolvido em projetos modernos com <strong>Next.js</strong>, <strong>React.js</strong> e <strong>Angular</strong>, com conhecimento prático em <strong>Python</strong>, <strong>AWS</strong> e <strong>Java</strong>.
        </p>
        <p>
          Domínio de bancos relacionais e não relacionais como <strong>PostgreSQL</strong>, <strong>MySQL</strong> e <strong>MongoDB</strong>.
          Possui certificações em <strong>Power BI</strong>, <strong>Kubernetes</strong> e <strong>Docker</strong> (nível básico), demonstrando versatilidade em desenvolvimento, análise de dados e infraestrutura.
        </p>
        <p>
          Um profissional flexível e comprometido, focado em entregar soluções robustas, eficientes e escaláveis.
        </p>
      `
    };

    function changeLanguage(lang) {
      document.getElementById('profile').innerHTML = profileContent[lang];
    }

    // Set default language
    changeLanguage('en');
  </script>

</body>
</html>
