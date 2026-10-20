package com.demo.upimesh.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TransactionEventRepository extends JpaRepository<TransactionEvent, Long> {
    List<TransactionEvent> findByTransactionIdOrderByCreatedAtAsc(Long transactionId);
}
