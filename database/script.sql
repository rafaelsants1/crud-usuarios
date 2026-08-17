-- =============================================================================
-- CRUD de Usuários — script de criação do banco
-- MySQL 8.0.46
--
-- Este arquivo é a fonte da verdade do schema. A aplicação sobe com
-- spring.jpa.hibernate.ddl-auto=validate, ou seja, o Hibernate NÃO cria nem
-- altera nada: ele apenas confere se o banco corresponde ao mapeamento da
-- entidade Usuario. Qualquer divergência aqui impede a aplicação de iniciar.
--
-- Execução:
--   mysql -u root -p < database/script.sql
-- ou abrindo o arquivo no MySQL Workbench e executando o script inteiro.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS crud_usuarios
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE crud_usuarios;

CREATE TABLE IF NOT EXISTS usuario (

    id              BIGINT       NOT NULL AUTO_INCREMENT,

    nome            VARCHAR(60)  NOT NULL,

    email           VARCHAR(60)  NOT NULL,

    -- CPF é CHAR(11) e não um tipo numérico de propósito.
    -- 1) Um CPF nunca entra em conta aritmética: é um identificador, não uma
    --    quantidade. Guardá-lo como BIGINT seria escolher o tipo errado pela
    --    aparência do dado.
    -- 2) Zeros à esquerda são significativos. O CPF 01234567890 viraria
    --    1234567890 em qualquer coluna numérica — dez dígitos, documento
    --    inválido e impossível de recuperar.
    -- CHAR (e não VARCHAR) porque o tamanho é fixo em 11: não há variação a
    -- acomodar, e o comprimento fixo já funciona como uma primeira barreira
    -- contra valores truncados.
    cpf             CHAR(11)     NOT NULL,

    -- Telefone é o único campo opcional do cadastro. Nome, e-mail, CPF e data
    -- de nascimento identificam ou qualificam a pessoa e são exigidos sempre;
    -- telefone é apenas um canal de contato, que pode não existir no momento
    -- do cadastro. Por isso aceita NULL e, diferente de e-mail e CPF, NÃO tem
    -- restrição UNIQUE: é normal duas pessoas da mesma casa ou da mesma
    -- empresa compartilharem um número.
    -- VARCHAR(20) porque o formato varia (com ou sem DDD, fixo ou celular) e
    -- porque, como no CPF, o valor é texto e não número.
    telefone        VARCHAR(20)  NULL,

    data_nascimento DATE         NOT NULL,

    -- DATETIME (data e hora, sem fuso) para casar com o LocalDateTime da
    -- entidade. O DEFAULT existe como rede de segurança para inserções feitas
    -- direto no banco; pela aplicação o valor vem do @PrePersist da entidade.
    data_cadastro   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_usuario        PRIMARY KEY (id),
    CONSTRAINT uk_usuario_email  UNIQUE (email),
    CONSTRAINT uk_usuario_cpf    UNIQUE (cpf)

) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

-- =============================================================================
-- Dados de exemplo (opcional).
-- Descomente o bloco abaixo para subir a aplicação já com registros na tela.
-- data_cadastro é deixado de fora para que o DEFAULT preencha.
-- =============================================================================

-- INSERT INTO usuario (nome, email, cpf, telefone, data_nascimento) VALUES
--     ('Maria Silva',        'maria.silva@email.com',   '01234567890', '79999998888', '1998-04-12'),
--     ('João Pereira',       'joao.pereira@email.com',  '98765432100', NULL,          '1991-11-03'),
--     ('Ana Beatriz Rocha',  'ana.rocha@email.com',     '45678912300', '7933334444',  '2003-07-25');
