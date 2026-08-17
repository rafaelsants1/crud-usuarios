# CRUD de Usuários

Aplicação web de cadastro de usuários construída em **três camadas** (apresentação → serviço → persistência), com API REST em Spring Boot, banco MySQL e front-end em HTML, CSS e JavaScript puros.

Trabalho acadêmico individual do **4º período de Análise e Desenvolvimento de Sistemas**. O objetivo é demonstrar, num escopo pequeno e completo, a separação de responsabilidades entre camadas: o *controller* só fala HTTP, o *service* concentra as regras de negócio, o *repository* isola o acesso ao banco e a interface consome exclusivamente a API.

O sistema mantém um cadastro com nome, e-mail, CPF, telefone, data de nascimento e data de cadastro, oferecendo as cinco operações de um CRUD completo (listar, buscar por id, cadastrar, editar e excluir), com validação de dados e tratamento de duplicidade de CPF e e-mail.

---

## Repositório

**https://github.com/rafaelsants1/crud-usuarios**

```bash
git clone https://github.com/rafaelsants1/crud-usuarios.git
```

---

## Tecnologias utilizadas

| Camada / Ferramenta | Versão | Observação |
|---|---|---|
| Java | 25 | *Release target* definido em `pom.xml` (`<java.version>25</java.version>`), compilado e executado com o JDK 25.0.2 LTS. |
| Spring Boot | 4.1.0 | `spring-boot-starter-webmvc`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation` |
| Spring Data JPA / Hibernate | fornecido pelo Spring Boot 4.1.0 | `ddl-auto=validate` — o schema é criado pelo script SQL, não pelo ORM |
| Bean Validation (Jakarta) | fornecido pelo starter | Validações declaradas na entidade `Usuario` |
| MySQL | 8.0.46 | Driver `com.mysql:mysql-connector-j` |
| Front-end | HTML5, CSS3, JavaScript ES6+ | Sem framework, sem biblioteca, sem CDN |
| Build | Maven Wrapper (`mvnw` / `mvnw.cmd`) | Não é necessário ter o Maven instalado |

---

## Como executar

### Pré-requisitos

- **JDK 25 ou superior** instalado e no `PATH` (`java -version` deve responder).
- **MySQL Server 8.0** rodando em `localhost:3306`, com um usuário que possa criar bancos.
- **Não é preciso instalar o Maven** — o projeto usa o Maven Wrapper.

### 1. Criar o banco de dados

Execute o script versionado. Ele cria o banco `crud_usuarios` e a tabela `usuario` com todas as restrições:

```bash
mysql -u root -p < database/script.sql
```

Ou abra `database/script.sql` no MySQL Workbench e execute o script inteiro.

> A aplicação sobe com `spring.jpa.hibernate.ddl-auto=validate`: o Hibernate **não cria nem altera** tabelas, apenas confere se o banco bate com o mapeamento da entidade. Se o script não for executado antes, a aplicação não inicia.

### 2. Configurar as credenciais

O arquivo `application.properties` está no `.gitignore` justamente para que a senha do banco não vá para o repositório. Copie o modelo e preencha:

```bash
# Windows (PowerShell)
Copy-Item src\main\resources\application.properties.example src\main\resources\application.properties

# Linux / macOS
cp src/main/resources/application.properties.example src/main/resources/application.properties
```

Abra o arquivo copiado e substitua `SUA_SENHA_AQUI` pela senha real do MySQL (ajuste também `spring.datasource.username`, se não for `root`).

### 3. Subir a aplicação

O Maven não está no `PATH` — use sempre o wrapper:

```powershell
.\mvnw.cmd spring-boot:run
```

```bash
# Linux / macOS
./mvnw spring-boot:run
```

### 4. Acessar

Abra o navegador em:

```
http://localhost:8080
```

O front-end é servido pelo próprio Spring, a partir de `src/main/resources/static`. Como a interface e a API estão na mesma origem (mesmo host e mesma porta), **não há nenhuma configuração de CORS envolvida**.

---

## Estrutura da aplicação

```
crud-usuarios/
│
├── database/
│   └── script.sql                     Criação do banco e da tabela. Fonte da verdade
│                                      do schema, já que o Hibernate roda em modo
│                                      validate e não gera DDL.
│
├── src/main/java/com/faculdade/crudusuarios/
│   │
│   ├── CrudUsuariosApplication.java   Ponto de entrada (@SpringBootApplication).
│   │
│   ├── Usuario.java                   ENTIDADE. Mapeia a tabela `usuario` via JPA e
│   │                                  concentra as regras de formato dos dados em
│   │                                  Bean Validations (@NotBlank, @Email, @Pattern
│   │                                  de 11 dígitos no CPF, @Past na data de
│   │                                  nascimento). O @PrePersist carimba a
│   │                                  data_cadastro no momento da inserção.
│   │
│   ├── repository/
│   │   └── UsuarioRepository.java     PERSISTÊNCIA. Interface que estende
│   │                                  JpaRepository — o Spring Data implementa em
│   │                                  tempo de execução. Declara as consultas
│   │                                  derivadas existsByCpf e existsByEmail, usadas
│   │                                  pela checagem de duplicidade.
│   │
│   ├── service/
│   │   └── UsuarioService.java        REGRA DE NEGÓCIO. Camada intermediária, a
│   │                                  única que decide o que é um estado válido:
│   │                                  bloqueia CPF/e-mail repetidos no cadastro,
│   │                                  permite que o usuário em edição mantenha os
│   │                                  próprios CPF e e-mail, e lança as exceções de
│   │                                  domínio quando um id não existe. Não conhece
│   │                                  HTTP nem status codes.
│   │
│   ├── controller/
│   │   └── UsuarioController.java     APRESENTAÇÃO (lado servidor). @RestController
│   │                                  mapeado em /usuarios. Traduz requisição HTTP
│   │                                  em chamada de serviço e resultado de serviço
│   │                                  em resposta HTTP com o status certo. Dispara a
│   │                                  validação da entidade com @Valid.
│   │
│   └── exception/
│       ├── RecursoNaoEncontradoException.java   Exceção de domínio: id inexistente.
│       ├── RecursoDuplicadoException.java       Exceção de domínio: CPF/e-mail já usado.
│       └── GlobalExceptionHandler.java          @RestControllerAdvice que converte
│                                                essas exceções em 404 e 409. Sem ele,
│                                                o service precisaria conhecer HTTP.
│
├── src/main/resources/
│   ├── application.properties.example Modelo de configuração versionado.
│   ├── application.properties         Configuração real (ignorada pelo Git).
│   └── static/                        FRONT-END. Tudo aqui é servido estaticamente
│       ├── index.html                 pelo Spring na raiz do site.
│       ├── style.css                  Estrutura, estilo e comportamento da interface.
│       └── script.js                  script.js é a única parte que fala com a API.
│
├── pom.xml                            Dependências e build (Maven).
└── mvnw / mvnw.cmd                    Maven Wrapper.
```

### O caminho de uma requisição

```
Navegador (script.js)
   → HTTP → UsuarioController      traduz HTTP ↔ objetos
              → UsuarioService     aplica as regras, lança exceções de domínio
                   → UsuarioRepository → MySQL
```

As exceções lançadas pelo service sobem até o `GlobalExceptionHandler`, que decide o status HTTP. Nenhuma camada de baixo conhece a de cima.

---

## Endpoints da API

Base: `http://localhost:8080`

| Verbo | Rota | Descrição | Status possíveis |
|---|---|---|---|
| `GET` | `/usuarios` | Lista todos os usuários cadastrados. Devolve um array JSON (vazio se não houver registros). | `200 OK` |
| `GET` | `/usuarios/{id}` | Busca um usuário pelo id. | `200 OK` · `404 Not Found` |
| `POST` | `/usuarios` | Cadastra um novo usuário. O corpo não deve conter `id` nem `dataCadastro` — ambos são gerados pelo servidor. | `201 Created` · `400 Bad Request` · `409 Conflict` |
| `PUT` | `/usuarios/{id}` | Atualiza todos os campos editáveis do usuário. A `dataCadastro` original é preservada. | `200 OK` · `400 Bad Request` · `404 Not Found` · `409 Conflict` |
| `DELETE` | `/usuarios/{id}` | Exclui o usuário. Resposta sem corpo. | `204 No Content` · `404 Not Found` |

**Quando cada erro acontece**

- `400 Bad Request` — alguma Bean Validation da entidade falhou (nome vazio, e-mail malformado, CPF fora do padrão de 11 dígitos, data de nascimento no presente ou no futuro).
- `404 Not Found` — o id informado não existe. Corpo: mensagem de texto vinda do `GlobalExceptionHandler`.
- `409 Conflict` — o CPF ou o e-mail já pertencem a outro usuário. Corpo: mensagem de texto vinda do `GlobalExceptionHandler`.

### Formato do usuário

Resposta da API:

```json
{
  "id": 1,
  "nome": "Maria Silva",
  "email": "maria.silva@email.com",
  "cpf": "01234567890",
  "telefone": "79999998888",
  "dataNascimento": "1998-04-12",
  "dataCadastro": "2026-08-16T14:32:10"
}
```

Corpo enviado no `POST` e no `PUT` (mesmo formato, sem `id` e sem `dataCadastro`):

```json
{
  "nome": "Maria Silva",
  "email": "maria.silva@email.com",
  "cpf": "01234567890",
  "telefone": "79999998888",
  "dataNascimento": "1998-04-12"
}
```

> **CPF trafega como string, sempre.** O valor `01234567890` viraria `1234567890` se fosse tratado como número em qualquer ponto do caminho — o zero à esquerda é significativo. Por isso a coluna é `CHAR(11)`, o campo da entidade é `String` e o front-end nunca converte esse valor.

> **Telefone é o único campo opcional.** Aceita `null` e não tem restrição de unicidade: é normal duas pessoas compartilharem o mesmo número.
