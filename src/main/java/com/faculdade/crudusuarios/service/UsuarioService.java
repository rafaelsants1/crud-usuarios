package com.faculdade.crudusuarios.service;

import com.faculdade.crudusuarios.Usuario;
import com.faculdade.crudusuarios.exception.RecursoDuplicadoException;
import com.faculdade.crudusuarios.exception.RecursoNaoEncontradoException;
import com.faculdade.crudusuarios.repository.UsuarioRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;
@Service
public class UsuarioService {
    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public List<Usuario> listarTodos() {
        return usuarioRepository.findAll();
    }

    public Usuario cadastrar(Usuario usuario) {
        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new RecursoDuplicadoException("Já existe um usuário cadastrado com o CPF " + usuario.getCpf());
        }
        if (usuarioRepository.existsByEmail(usuario.getEmail())) {
            throw new RecursoDuplicadoException("Já existe um usuário cadastrado com o E-mail " + usuario.getEmail());
        }
        return usuarioRepository.save(usuario);
    }

    public Usuario buscarPorId(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Não foi possível localizar o usuário com Id " + id));
    }

    public void deletar(Long id){
        if (!usuarioRepository.existsById(id)) {
            throw new RecursoNaoEncontradoException("Não foi possível localizar o id " + id);
        }
        usuarioRepository.deleteById(id);
    }

    public Usuario editar(Long id, Usuario dadosNovos) {
        Usuario usuario = buscarPorId(id);

        if(!usuario.getCpf().equals(dadosNovos.getCpf()) && usuarioRepository.existsByCpf(dadosNovos.getCpf())) {
            throw new RecursoDuplicadoException("O CPF " + dadosNovos.getCpf() + " já pertence a outro usuário");
        }

        if(!usuario.getEmail().equals(dadosNovos.getEmail()) && usuarioRepository.existsByEmail(dadosNovos.getEmail())) {
            throw new RecursoDuplicadoException("O E-mail " + dadosNovos.getEmail() + " já pertence a outro usuário");
        }
        
        usuario.setNome(dadosNovos.getNome());
        usuario.setCpf(dadosNovos.getCpf());
        usuario.setEmail(dadosNovos.getEmail());
        usuario.setTelefone(dadosNovos.getTelefone());
        usuario.setDataNascimento(dadosNovos.getDataNascimento());


        return usuarioRepository.save(usuario);
    }
}
